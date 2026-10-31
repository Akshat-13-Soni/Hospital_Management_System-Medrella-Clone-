import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, doctors, payments, users } from "@/db/schema";
import { drName, fmtDate, notify } from "./notify";

// Frees slots whose payment window ran out. Safe to call any time.
export async function releaseExpiredHolds() {
  const released = await db
    .update(appointments)
    .set({ status: "cancelled", holdExpiresAt: null })
    .where(and(eq(appointments.status, "pending_payment"), lt(appointments.holdExpiresAt, sql`now()`)))
    .returning({ id: appointments.id });

  if (released.length > 0) {
    await db
      .update(payments)
      .set({ status: "abandoned", updatedAt: new Date() })
      .where(
        and(
          inArray(payments.appointmentId, released.map((r) => r.id)),
          inArray(payments.status, ["created", "pending"])
        )
      );
  }
  return released.length;
}

// Idempotent: calling it twice for the same payment is harmless.
export async function markPaid(orderId: string, paymentId: string) {
  const [p] = await db.select().from(payments).where(eq(payments.providerOrderId, orderId));
  if (!p) return { ok: false as const, reason: "unknown_order" };

  await db
    .update(payments)
    .set({ status: "paid", providerPaymentId: paymentId, paidAt: new Date(), updatedAt: new Date(), failureReason: null })
    .where(
      and(eq(payments.id, p.id), inArray(payments.status, ["created", "pending", "failed", "abandoned"]))
    );

  const [appt] = await db
    .update(appointments)
    .set({ status: "booked", holdExpiresAt: null })
    .where(and(eq(appointments.id, p.appointmentId), eq(appointments.status, "pending_payment")))
    .returning({
      id: appointments.id,
      doctorId: appointments.doctorId,
      patientId: appointments.patientId,
      date: appointments.date,
      startTime: appointments.startTime,
    });

  if (!appt) {
    // Already booked (duplicate event) or the hold was released before the money arrived.
    const [current] = await db.select({ status: appointments.status }).from(appointments).where(eq(appointments.id, p.appointmentId));
    if (current && current.status !== "booked" && current.status !== "completed") {
      await db.update(payments).set({ failureReason: "late_payment_needs_refund" }).where(eq(payments.id, p.id));
    }
    return { ok: true as const, confirmed: current?.status === "booked" };
  }

  const [doc] = await db
    .select({ userId: doctors.userId, name: users.name })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, appt.doctorId));
  const [pat] = await db.select({ name: users.name }).from(users).where(eq(users.id, appt.patientId));

  if (doc) {
    await notify(appt.patientId, `Payment received. Your appointment with ${drName(doc.name)} on ${fmtDate(appt.date)} at ${appt.startTime} is confirmed.`);
    await notify(doc.userId, `New appointment: ${pat?.name ?? "A patient"} on ${fmtDate(appt.date)} at ${appt.startTime}.`);
  }
  return { ok: true as const, confirmed: true };
}

export async function markFailed(orderId: string, reason?: string) {
  await db
    .update(payments)
    .set({ status: "failed", failureReason: reason ?? "payment_failed", updatedAt: new Date() })
    .where(and(eq(payments.providerOrderId, orderId), inArray(payments.status, ["created", "pending"])));
}