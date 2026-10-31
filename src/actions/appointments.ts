"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { appointments, doctors, payments, rescheduleHistory, users } from "@/db/schema";
import { drName, fmtDate, notify } from "@/lib/notify";
import type { CheckoutInfo } from "@/lib/payment-types";
import { releaseExpiredHolds } from "@/lib/payments";
import { getAvailableSlots } from "@/lib/queries";
import { HOLD_MINUTES, getRazorpay } from "@/lib/razorpay";
import { getSession } from "@/lib/session";
import { bookSchema, rescheduleSchema } from "@/lib/validators";

type Result = { ok: true } | { ok: false; error: string };
type BookResult = { ok: true; checkout: CheckoutInfo | null } | { ok: false; error: string };

const isUniqueViolation = (e: any) => (e?.code ?? e?.cause?.code) === "23505";

async function getDoctorUser(doctorId: string) {
  const [row] = await db
    .select({ userId: doctors.userId, name: users.name, fee: doctors.fee })
    .from(doctors)
    .innerJoin(users, eq(users.id, doctors.userId))
    .where(eq(doctors.id, doctorId));
  return row ?? null;
}

function revalidateAll() {
  revalidatePath("/patient");
  revalidatePath("/doctor");
}

export async function bookAppointment(input: unknown): Promise<BookResult> {
  const session = await getSession();
  if (!session || session.role !== "patient") return { ok: false, error: "Please sign in as a patient to book" };

  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid booking details" };
  const { doctorId, date, startTime, reason } = parsed.data;

  const doc = await getDoctorUser(doctorId);
  if (!doc) return { ok: false, error: "Doctor not found" };

  await releaseExpiredHolds();

  const slots = await getAvailableSlots(doctorId, date);
  const slot = slots.find((s) => s.startTime === startTime);
  if (!slot) return { ok: false, error: "That slot is no longer available" };

  const needsPayment = doc.fee > 0;

  let appointmentId: string;
  try {
    const [row] = await db
      .insert(appointments)
      .values({
        doctorId, patientId: session.userId, date,
        startTime: slot.startTime, endTime: slot.endTime, reason,
        status: needsPayment ? "pending_payment" : "booked",
        holdExpiresAt: needsPayment ? new Date(Date.now() + HOLD_MINUTES * 60_000) : null,
      })
      .returning({ id: appointments.id });
    appointmentId = row.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Someone just booked this slot. Pick another." };
    return { ok: false, error: "Could not book appointment" };
  }

  // Free consultation: confirm straight away
  if (!needsPayment) {
    await notify(session.userId, `Your appointment with ${drName(doc.name)} on ${fmtDate(date)} at ${slot.startTime} is confirmed.`);
    await notify(doc.userId, `New appointment: ${session.name} on ${fmtDate(date)} at ${slot.startTime}.`);
    revalidateAll();
    return { ok: true, checkout: null };
  }

  // Paid consultation: create the order using the fee stored in the database
  try {
    const amountPaise = doc.fee * 100;
    const { client, keyId } = getRazorpay();
    const order = await client.orders.create({
      amount: amountPaise,
      currency: "INR",
      receipt: appointmentId,
      notes: { appointmentId },
    });
    await db.insert(payments).values({
      appointmentId, providerOrderId: order.id, amountPaise, currency: "INR", status: "created",
    });
    const [me] = await db.select({ email: users.email }).from(users).where(eq(users.id, session.userId));
    revalidateAll();
    return {
      ok: true,
      checkout: {
        keyId, orderId: order.id, amountPaise, currency: "INR",
        doctorName: drName(doc.name), patientName: session.name, patientEmail: me?.email ?? "",
      },
    };
  } catch (err) {
    console.error("[payments] order creation failed:", err);
    // Could not start payment: release the slot
    await db.update(appointments).set({ status: "cancelled", holdExpiresAt: null }).where(eq(appointments.id, appointmentId));
    return { ok: false, error: "Could not start the payment. Please try again." };
  }
}

export async function rescheduleAppointment(input: unknown): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== "patient") return { ok: false, error: "Please sign in as a patient" };

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid details" };
  const { appointmentId, date, startTime } = parsed.data;

  const [appt] = await db.select().from(appointments).where(eq(appointments.id, appointmentId));
  if (!appt || appt.patientId !== session.userId) return { ok: false, error: "Appointment not found" };
  if (appt.status !== "booked") return { ok: false, error: "Only booked appointments can be rescheduled" };

  await releaseExpiredHolds();
  const slot = (await getAvailableSlots(appt.doctorId, date)).find((s) => s.startTime === startTime);
  if (!slot) return { ok: false, error: "That slot is not available" };

  try {
    await db.update(appointments)
      .set({ date, startTime: slot.startTime, endTime: slot.endTime })
      .where(eq(appointments.id, appointmentId));
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: false, error: "Someone just booked this slot. Pick another." };
    return { ok: false, error: "Could not reschedule" };
  }

  await db.insert(rescheduleHistory).values({
    appointmentId, oldDate: appt.date, oldStartTime: appt.startTime,
    newDate: date, newStartTime: slot.startTime,
  });

  const doc = await getDoctorUser(appt.doctorId);
  await notify(session.userId, `Your appointment with ${drName(doc!.name)} is now on ${fmtDate(date)} at ${slot.startTime}.`);
  await notify(doc!.userId, `${session.name} rescheduled from ${fmtDate(appt.date)} ${appt.startTime} to ${fmtDate(date)} ${slot.startTime}.`);
  revalidateAll();
  return { ok: true };
}

async function loadOwned(id: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  const [appt] = await db
    .select({
      id: appointments.id, patientId: appointments.patientId, doctorId: appointments.doctorId,
      date: appointments.date, startTime: appointments.startTime, status: appointments.status,
      doctorUserId: doctors.userId,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .where(eq(appointments.id, id));
  if (!appt) throw new Error("Not found");
  return { session, appt };
}

export async function cancelAppointment(id: string) {
  const { session, appt } = await loadOwned(id);
  if (session.userId !== appt.patientId && session.userId !== appt.doctorUserId) throw new Error("Forbidden");
  if (appt.status !== "booked") return;

  await db.update(appointments).set({ status: "cancelled" }).where(eq(appointments.id, id));

  const when = `${fmtDate(appt.date)} at ${appt.startTime}`;
  if (session.userId === appt.doctorUserId) {
    await notify(appt.patientId, `${drName(session.name)} cancelled your appointment on ${when}.`);
  } else {
    await notify(appt.doctorUserId, `${session.name} cancelled their appointment on ${when}. The slot is free again.`);
  }
  revalidateAll();
}

export async function completeAppointment(id: string) {
  const { session, appt } = await loadOwned(id);
  if (session.userId !== appt.doctorUserId) throw new Error("Forbidden");
  if (appt.status !== "booked") return;
  await db.update(appointments).set({ status: "completed" }).where(eq(appointments.id, id));
  revalidatePath("/doctor");
}