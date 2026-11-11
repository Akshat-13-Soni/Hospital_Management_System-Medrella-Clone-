import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctorLeaves } from "@/db/schema";
import { cancelBooked } from "./cancellation";
import { istNow, toMin } from "./slots";

export async function isOnLeave(doctorId: string, date: string) {
  const [row] = await db
    .select({ id: doctorLeaves.id })
    .from(doctorLeaves)
    .where(and(eq(doctorLeaves.doctorId, doctorId), eq(doctorLeaves.date, date)))
    .limit(1);
  return !!row;
}

export async function listLeaveDays(doctorId: string) {
  const { today } = istNow();
  const rows = await db
    .select({ date: doctorLeaves.date })
    .from(doctorLeaves)
    .where(eq(doctorLeaves.doctorId, doctorId));
  return rows.map((r) => r.date).filter((d) => d >= today).sort();
}

// One pass over the day: release unpaid holds, then cancel booked appointments
async function sweepDay(doctorId: string, date: string) {
  const { today, nowMin } = istNow();

  // Unpaid holds: free the slot so a late payment cannot confirm a booking on a day off
  await db
    .update(appointments)
    .set({ status: "cancelled", holdExpiresAt: null })
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date), eq(appointments.status, "pending_payment")));

  const booked = await db
    .select({ id: appointments.id, startTime: appointments.startTime })
    .from(appointments)
    .where(and(eq(appointments.doctorId, doctorId), eq(appointments.date, date), eq(appointments.status, "booked")));

  let cancelled = 0;
  for (const b of booked) {
    if (date === today && toMin(b.startTime) <= nowMin) continue; // already started today
    // Each cancel is one conditional update, so running it twice cannot refund or notify twice
    if (await cancelBooked({ appointmentId: b.id, by: "leave" })) cancelled++;
  }
  return cancelled;
}

export async function addLeaveDay(doctorId: string, date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false as const, error: "Invalid date" };
  const { today } = istNow();
  if (date < today) return { ok: false as const, error: "Choose today or a future date" };

  // 1) Mark the day first, so new bookings are refused from now on
  await db.insert(doctorLeaves).values({ doctorId, date }).onConflictDoNothing();

  // 2) Sweep, then sweep again to catch a booking that was mid-flight when the day was marked
  let cancelled = await sweepDay(doctorId, date);
  cancelled += await sweepDay(doctorId, date);
  return { ok: true as const, cancelled };
}

export async function removeLeaveDay(doctorId: string, date: string) {
  await db.delete(doctorLeaves).where(and(eq(doctorLeaves.doctorId, doctorId), eq(doctorLeaves.date, date)));
  return { ok: true as const };
}