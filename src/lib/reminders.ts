import { and, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctors, reminders, users } from "@/db/schema";
import { drName, fmtDate, notify } from "./notify";
import { istNow } from "./slots";
import { onReminder } from "./events";

// Configurable: REMINDER_HOURS="24,1" means a reminder 24h and 1h before the appointment
export function reminderHours(): number[] {
  const hours = (process.env.REMINDER_HOURS ?? "24,1")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return hours.length ? hours : [24, 1];
}

// Clinic time is IST
const startOf = (date: string, startTime: string) => new Date(`${date}T${startTime}:00+05:30`);

async function upsertFor(appt: { id: string; date: string; startTime: string }) {
  const start = startOf(appt.date, appt.startTime).getTime();
  for (const h of reminderHours()) {
    const sendAt = new Date(start - h * 3_600_000);
    if (sendAt.getTime() <= Date.now()) continue; // that reminder time has already passed
    await db
      .insert(reminders)
      .values({ appointmentId: appt.id, kind: `${h}h`, sendAt })
      .onConflictDoUpdate({
        target: [reminders.appointmentId, reminders.kind],
        set: { sendAt, status: "pending", sentAt: null },
      });
  }
}

async function loadAppt(id: string) {
  const [a] = await db
    .select({ id: appointments.id, date: appointments.date, startTime: appointments.startTime })
    .from(appointments)
    .where(eq(appointments.id, id));
  return a ?? null;
}

// Call when an appointment becomes "booked"
export async function scheduleReminders(appointmentId: string) {
  const a = await loadAppt(appointmentId);
  if (a) await upsertFor(a);
}

// Call after the date or time changed: drop the old schedule, create the new one
export async function rescheduleReminders(appointmentId: string) {
  await cancelReminders(appointmentId);
  await scheduleReminders(appointmentId);
}

// Call when an appointment is cancelled or completed
export async function cancelReminders(appointmentId: string) {
  await db
    .update(reminders)
    .set({ status: "cancelled" })
    .where(and(eq(reminders.appointmentId, appointmentId), eq(reminders.status, "pending")));
}

// Booked, upcoming appointments that have no reminder rows yet (made before this feature)
async function backfill() {
  const { today } = istNow();
  const missing = await db
    .select({ id: appointments.id, date: appointments.date, startTime: appointments.startTime })
    .from(appointments)
    .leftJoin(reminders, eq(reminders.appointmentId, appointments.id))
    .where(and(eq(appointments.status, "booked"), gte(appointments.date, today), isNull(reminders.id)));
  for (const a of missing) await upsertFor(a);
}

// Sends every reminder that is due. Safe to call as often as you like.
export async function processDueReminders() {
  await backfill();
  const now = new Date();

  const due = await db
    .select({
      id: reminders.id,
      sendAt: reminders.sendAt,
      appointmentId: appointments.id,
      status: appointments.status,
      date: appointments.date,
      startTime: appointments.startTime,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
    })
    .from(reminders)
    .innerJoin(appointments, eq(appointments.id, reminders.appointmentId))
    .where(and(eq(reminders.status, "pending"), lte(reminders.sendAt, now)));

  let sent = 0, skipped = 0, failed = 0;
  for (const r of due) {
    // Claim it first, so two overlapping runs can never send the same reminder twice
    const [claimed] = await db
      .update(reminders)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(reminders.id, r.id), eq(reminders.status, "pending")))
      .returning({ id: reminders.id });
    if (!claimed) continue;

    const start = startOf(r.date, r.startTime);
    // Never remind about cancelled or completed appointments, or ones already under way
    if (r.status !== "booked" || start.getTime() <= now.getTime()) {
      await db.update(reminders).set({ status: "cancelled", sentAt: null }).where(eq(reminders.id, r.id));
      skipped++;
      continue;
    }

    try {
      const [doc] = await db
        .select({ name: users.name })
        .from(doctors)
        .innerJoin(users, eq(users.id, doctors.userId))
        .where(eq(doctors.id, r.doctorId));
      const hours = Math.max(1, Math.round((start.getTime() - now.getTime()) / 3_600_000));
      await onReminder({
        reminderId: r.id,
        sendAtIso: r.sendAt.toISOString(),
        appointmentId: r.appointmentId,
        hours,
      });
      sent++;
    } catch (err) {
      console.error("[reminders] send failed:", err);
      await db.update(reminders).set({ status: "failed" }).where(eq(reminders.id, r.id));
      failed++;
    }
  }
  return { sent, skipped, failed };
}