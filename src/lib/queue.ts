import { and, asc, eq, inArray, isNotNull, max } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { appointments, doctors, queueEntries, users } from "@/db/schema";
import { isActiveStatus, positionOf, summarize, type QueueRow } from "./queue-rank";
import { cancelReminders } from "./reminders";
import { istNow } from "./slots";

type Result = { ok: true } | { ok: false; error: string };
const isUniqueViolation = (e: any) => (e?.code ?? e?.cause?.code) === "23505";
const ACTIVE = ["waiting", "in_consultation"];

async function entriesFor(doctorId: string, date: string) {
  return (await db
    .select({ id: queueEntries.id, tokenNo: queueEntries.tokenNo, status: queueEntries.status })
    .from(queueEntries)
    .where(and(eq(queueEntries.doctorId, doctorId), eq(queueEntries.queueDate, date)))) as QueueRow[];
}

// When nobody is being seen, the first patient in line becomes the current one.
// The status guard makes it safe if two requests race.
async function promoteNext(doctorId: string, date: string) {
  const { current, next } = summarize(await entriesFor(doctorId, date));
  if (current || !next) return;
  await db.update(queueEntries)
    .set({ status: "in_consultation", startedAt: new Date() })
    .where(and(eq(queueEntries.id, next.id), eq(queueEntries.status, "waiting")));
}

// Close an active entry, then let the next patient step up
async function closeEntry(appointmentId: string, status: "completed" | "no_show" | "cancelled") {
  const [e] = await db.update(queueEntries)
    .set({ status, finishedAt: new Date() })
    .where(and(eq(queueEntries.appointmentId, appointmentId), inArray(queueEntries.status, ACTIVE)))
    .returning({ doctorId: queueEntries.doctorId, queueDate: queueEntries.queueDate });
  if (e) await promoteNext(e.doctorId, e.queueDate);
  return !!e;
}

export async function checkInPatient(appointmentId: string, byUserId: string): Promise<Result> {
  const [appt] = await db
    .select({ id: appointments.id, doctorId: appointments.doctorId, date: appointments.date, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));

  if (!appt) return { ok: false, error: "Appointment not found" };
  if (appt.status !== "booked") return { ok: false, error: "Only confirmed appointments can be checked in" };
  if (appt.date !== istNow().today) return { ok: false, error: "Check-in is only open on the day of the appointment" };

  // The unique indexes reject a duplicate token or a second check-in, so concurrent
  // check-ins cannot clash even without transactions.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [existing] = await db
      .select({ tokenNo: queueEntries.tokenNo })
      .from(queueEntries)
      .where(eq(queueEntries.appointmentId, appointmentId));
    if (existing) {
      return { ok: false, error: existing.tokenNo ? `Already checked in (token ${existing.tokenNo})` : "Already marked as no-show" };
    }

    const [m] = await db.select({ n: max(queueEntries.tokenNo) }).from(queueEntries)
      .where(and(eq(queueEntries.doctorId, appt.doctorId), eq(queueEntries.queueDate, appt.date)));
    try {
      await db.insert(queueEntries).values({
        appointmentId, doctorId: appt.doctorId, queueDate: appt.date,
        tokenNo: (m?.n ?? 0) + 1, checkedInBy: byUserId,
      });
      await promoteNext(appt.doctorId, appt.date);
      return { ok: true };
    } catch (e) {
      if (isUniqueViolation(e)) continue; // token taken or already checked in: loop re-checks
      throw e;
    }
  }
  return { ok: false, error: "Queue is busy, please try again" };
}

// Works for a patient in the queue and for one who never arrived (no queue entry yet)
export async function recordNoShow(appointmentId: string): Promise<Result> {
  const [appt] = await db
    .select({ date: appointments.date, status: appointments.status })
    .from(appointments)
    .where(eq(appointments.id, appointmentId));
  if (!appt || appt.status !== "booked") return { ok: false, error: "Appointment not found" };
  if (appt.date !== istNow().today) return { ok: false, error: "No-show can only be recorded on the day" };

  const [won] = await db.update(appointments)
    .set({ status: "no_show" })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "booked")))
    .returning({ id: appointments.id });
  if (!won) return { ok: false, error: "Already updated" };

  await cancelReminders(appointmentId);
  await closeEntry(appointmentId, "no_show"); // frees the token and promotes the next patient
  return { ok: true };
}

// Receptionist "Complete": only the patient being seen can be completed
export async function completeFromQueue(appointmentId: string): Promise<Result> {
  const [e] = await db.select({ status: queueEntries.status }).from(queueEntries)
    .where(eq(queueEntries.appointmentId, appointmentId));
  if (!e || e.status !== "in_consultation") return { ok: false, error: "Only the patient being seen can be completed" };
  await db.update(appointments).set({ status: "completed" })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.status, "booked")));
  await cancelReminders(appointmentId);
  await closeEntry(appointmentId, "completed");
  return { ok: true };
}

// Hooks used by completeAppointment (doctor) and cancelBooked
export const finishQueueEntry = (appointmentId: string) => closeEntry(appointmentId, "completed");
export const cancelQueueEntry = (appointmentId: string) => closeEntry(appointmentId, "cancelled");

export async function hasActiveQueueEntry(appointmentId: string) {
  const [e] = await db.select({ status: queueEntries.status }).from(queueEntries)
    .where(eq(queueEntries.appointmentId, appointmentId));
  return !!e && isActiveStatus(e.status);
}

// Doctor's queue card: everyone who has a token today
export async function getDoctorQueue(doctorId: string, date: string) {
  return db
    .select({
      id: queueEntries.id, appointmentId: queueEntries.appointmentId, tokenNo: queueEntries.tokenNo,
      status: queueEntries.status, checkedInAt: queueEntries.checkedInAt, patientName: users.name,
    })
    .from(queueEntries)
    .innerJoin(appointments, eq(appointments.id, queueEntries.appointmentId))
    .innerJoin(users, eq(users.id, appointments.patientId))
    .where(and(eq(queueEntries.doctorId, doctorId), eq(queueEntries.queueDate, date), isNotNull(queueEntries.tokenNo)))
    .orderBy(asc(queueEntries.tokenNo));
}

// Receptionist view: every appointment today across all doctors, with its queue state
export async function getClinicDay(date: string) {
  const patientU = alias(users, "patient_u");
  const doctorU = alias(users, "doctor_u");
  return db
    .select({
      appointmentId: appointments.id, doctorId: appointments.doctorId, doctorName: doctorU.name,
      patientName: patientU.name, startTime: appointments.startTime, endTime: appointments.endTime,
      apptStatus: appointments.status, tokenNo: queueEntries.tokenNo, queueStatus: queueEntries.status,
      checkedInAt: queueEntries.checkedInAt,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(doctorU, eq(doctorU.id, doctors.userId))
    .innerJoin(patientU, eq(patientU.id, appointments.patientId))
    .leftJoin(queueEntries, eq(queueEntries.appointmentId, appointments.id))
    .where(and(eq(appointments.date, date), inArray(appointments.status, ["booked", "completed", "no_show"])))
    .orderBy(asc(doctorU.name), asc(appointments.startTime));
}

// Patient token card. Caller must already have verified the patient owns the appointment.
export async function getPatientQueueInfo(appointmentId: string) {
  const [e] = await db.select().from(queueEntries).where(eq(queueEntries.appointmentId, appointmentId));
  if (!e) return null;
  const rows = await entriesFor(e.doctorId, e.queueDate);
  const { current } = summarize(rows);
  return {
    tokenNo: e.tokenNo,
    status: e.status,
    checkedInAt: e.checkedInAt,
    position: positionOf(rows, e.id),
    nowServing: current?.tokenNo ?? null,
  };
}