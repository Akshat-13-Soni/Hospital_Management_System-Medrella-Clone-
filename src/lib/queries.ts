import { and, asc, count, desc, eq, gt, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, availability, doctorLeaves, doctors, notifications, payments, refunds, schedules, users} from "@/db/schema";
import { openSlots, type ScheduleWindow } from "./scheduling";
import {istNow, weekdayOf } from "./slots";

export async function listDoctors(q?: string) {
  const base = db
    .select({
      id: doctors.id,
      name: users.name,
      specialization: doctors.specialization,
      experienceYears: doctors.experienceYears,
      fee: doctors.fee,
      bio: doctors.bio,
      clinicAddress: doctors.clinicAddress,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId));

  if (!q?.trim()) return base.orderBy(asc(users.name));
  const like = `%${q.trim()}%`;
  return base.where(or(ilike(users.name, like), ilike(doctors.specialization, like))).orderBy(asc(users.name));
}

export async function getDoctor(id: string) {
  const [row] = await listDoctorsById(id);
  return row ?? null;
}
function listDoctorsById(id: string) {
  return db
    .select({
      id: doctors.id,
      name: users.name,
      specialization: doctors.specialization,
      experienceYears: doctors.experienceYears,
      fee: doctors.fee,
      bio: doctors.bio,
      clinicAddress: doctors.clinicAddress,
    })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, id));
}

export async function getDoctorByUserId(userId: string) {
  const [row] = await db.select().from(doctors).where(eq(doctors.userId, userId));
  return row ?? null;
}

export async function getAvailability(doctorId: string) {
  return db.select().from(availability).where(eq(availability.doctorId, doctorId)).orderBy(asc(availability.dayOfWeek));
}

// Which schedule applies on a date: a one-off date, else the weekly schedule, else plain availability
async function resolveWindow(doctorId: string, date: string): Promise<ScheduleWindow | null> {
  const rows = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.doctorId, doctorId), or(eq(schedules.date, date), eq(schedules.dayOfWeek, weekdayOf(date)))));
  const s = rows.find((r) => r.date === date) ?? rows[0];
  if (s) {
    return {
      type: s.type === "stream" ? "stream" : "wave",
      startTime: s.startTime, endTime: s.endTime, slotMinutes: s.slotMinutes ?? 30, capacity: s.capacity,
    };
  }
  const [av] = await db
    .select()
    .from(availability)
    .where(and(eq(availability.doctorId, doctorId), eq(availability.dayOfWeek, weekdayOf(date))));
  if (!av) return null;
  return { type: "wave", startTime: av.startTime, endTime: av.endTime, slotMinutes: av.slotMinutes, capacity: 1 };
}

export async function getAvailableSlots(doctorId: string, date: string) {
  const { today, nowMin } = istNow();
  if (date < today) return [];

  // Doctor is on leave that day: no slots
  const [leave] = await db
    .select({ id: doctorLeaves.id })
    .from(doctorLeaves)
    .where(and(eq(doctorLeaves.doctorId, doctorId), eq(doctorLeaves.date, date)))
    .limit(1);
  if (leave) return [];

  const window = await resolveWindow(doctorId, date);
  if (!window) return [];

  // Seats already held per slot: booked, or an unpaid hold that has not expired
  const rows = await db
    .select({ startTime: appointments.startTime, n: count() })
    .from(appointments)
    .where(
      and(
        eq(appointments.doctorId, doctorId),
        eq(appointments.date, date),
        or(
          eq(appointments.status, "booked"),
          and(eq(appointments.status, "pending_payment"), gt(appointments.holdExpiresAt, sql`now()`))
        )
      )
    )
    .groupBy(appointments.startTime);
  const taken = new Map(rows.map((r) => [r.startTime, Number(r.n)]));

  return openSlots(window, taken, date === today, nowMin);
}

export async function getSchedules(doctorId: string) {
  return db.select().from(schedules).where(eq(schedules.doctorId, doctorId)).orderBy(asc(schedules.dayOfWeek), asc(schedules.date));
}

export async function getDoctorAppointments(doctorUserId: string) {
  return db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      reason: appointments.reason,
      patientName: users.name,
      patientEmail: users.email,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, appointments.patientId))
        .where(and(eq(doctors.userId, doctorUserId), ne(appointments.status, "pending_payment")))
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}

export async function getPatientAppointments(patientId: string) {
  return db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      reason: appointments.reason,
      doctorName: users.name,
      specialization: doctors.specialization,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        or(ne(appointments.status, "pending_payment"), gt(appointments.holdExpiresAt, sql`now()`))
      )
    )
    .orderBy(asc(appointments.date), asc(appointments.startTime));
}

export async function getNotifications(userId: string) {
  return db.select().from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(30);
}

export async function getUnreadCount(userId: string) {
  const [r] = await db.select({ n: count() }).from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));
  return r?.n ?? 0;
}

export async function getPatientAppointment(id: string, patientId: string) {
  const [row] = await db
    .select({
      id: appointments.id,
      doctorId: appointments.doctorId,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      doctorName: users.name,
      specialization: doctors.specialization,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(and(eq(appointments.id, id), eq(appointments.patientId, patientId)));
  return row ?? null;
}

export async function getPatientPayments(patientId: string) {
  const rows = await db
    .select({
      id: payments.id,
      amountPaise: payments.amountPaise,
      status: payments.status,
      providerPaymentId: payments.providerPaymentId,
      paidAt: payments.paidAt,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      doctorName: users.name,
      specialization: doctors.specialization,
    })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(
      and(
        eq(appointments.patientId, patientId),
        inArray(payments.status, ["paid", "refunded", "partially_refunded", "failed"])
      )
    )
    .orderBy(desc(payments.createdAt));
  if (rows.length === 0) return [];

  const refundRows = await db
    .select()
    .from(refunds)
    .where(inArray(refunds.paymentId, rows.map((r) => r.id)))
    .orderBy(asc(refunds.createdAt));
  return rows.map((r) => ({ ...r, refunds: refundRows.filter((x) => x.paymentId === r.id) }));
}

// appointmentId -> amount (paise) still paid and refundable
export async function getPaidAmounts(patientId: string) {
  const rows = await db
    .select({ appointmentId: payments.appointmentId, amountPaise: payments.amountPaise })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .where(and(eq(appointments.patientId, patientId), eq(payments.status, "paid")));
  return new Map(rows.map((r) => [r.appointmentId, r.amountPaise]));
}