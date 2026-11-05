import { eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { appointments, doctors, users } from "@/db/schema";
import { emit } from "./notifier";
import { rupees } from "./money";
import { drName, fmtDate } from "./notify";

const doctorUser = alias(users, "doctor_user");
const patientUser = alias(users, "patient_user");

async function load(appointmentId: string) {
  const [r] = await db
    .select({
      id: appointments.id,
      date: appointments.date,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      patientId: appointments.patientId,
      patientName: patientUser.name,
      doctorUserId: doctorUser.id,
      doctorName: doctorUser.name,
    })
    .from(appointments)
    .innerJoin(doctors, eq(doctors.id, appointments.doctorId))
    .innerJoin(doctorUser, eq(doctorUser.id, doctors.userId))
    .innerJoin(patientUser, eq(patientUser.id, appointments.patientId))
    .where(eq(appointments.id, appointmentId));
  return r ?? null;
}

const when = (c: { date: string; startTime: string; endTime: string }) => ({
  date: fmtDate(c.date),
  time: `${c.startTime} – ${c.endTime}`,
});

// Paid bookings pass amountPaise and get a payment confirmation
export async function onBookingConfirmed(appointmentId: string, opts: { amountPaise?: number } = {}) {
  const c = await load(appointmentId);
  if (!c) return;
  const paid = opts.amountPaise !== undefined;
  const type = paid ? "payment_confirmed" : "booking_confirmed";
  await emit({
    userId: c.patientId, type, key: `${type}:${c.id}`,
    vars: { doctor: drName(c.doctorName), ...when(c), amount: paid ? rupees(opts.amountPaise!) : undefined },
  });
  await emit({
    userId: c.doctorUserId, type: "booking_new", key: `booking_new:${c.id}`,
    vars: { patient: c.patientName, ...when(c) },
  });
}

export async function onRescheduled(appointmentId: string, old: { date: string; startTime: string }) {
  const c = await load(appointmentId);
  if (!c) return;
  const key = `rescheduled:${c.id}:${c.date}:${c.startTime}`; // a later reschedule has a different key
  await emit({
    userId: c.patientId, type: "rescheduled", key,
    vars: { doctor: drName(c.doctorName), ...when(c) },
  });
  await emit({
    userId: c.doctorUserId, type: "rescheduled_doctor", key,
    vars: { patient: c.patientName, ...when(c), oldDate: fmtDate(old.date), oldTime: old.startTime },
  });
}

export async function onCancelled(appointmentId: string, info: { by: "patient" | "doctor"; note: string }) {
  const c = await load(appointmentId);
  if (!c) return;
  await emit({
    userId: c.patientId, type: "cancelled", key: `cancelled:${c.id}`,
    vars: { doctor: drName(c.doctorName), ...when(c), by: info.by, note: info.note },
  });
  if (info.by === "patient") {
    await emit({
      userId: c.doctorUserId, type: "cancelled_doctor_notice", key: `cancelled_notice:${c.id}`,
      vars: { patient: c.patientName, ...when(c) },
    });
  }
}

export async function onDoctorLeave(appointmentId: string, note: string) {
  const c = await load(appointmentId);
  if (!c) return;
  await emit({
    userId: c.patientId, type: "doctor_leave", key: `doctor_leave:${c.id}`,
    vars: { doctor: drName(c.doctorName), ...when(c), note },
  });
}

export async function onRefundSettled(args: {
  userId: string;
  refundId: string;
  status: "processed" | "failed";
  amountPaise: number;
  paymentRef?: string | null;
}) {
  const type = args.status === "processed" ? "refund_processed" : "refund_failed";
  await emit({
    userId: args.userId, type, key: `${type}:${args.refundId}`,
    vars: { amount: rupees(args.amountPaise), paymentRef: args.paymentRef ?? "" },
  });
}

export async function onLatePaymentRefund(args: {
  userId: string;
  paymentId: string;
  amountPaise: number;
  ok: boolean;
  paymentRef: string;
}) {
  await emit({
    userId: args.userId, type: "late_payment_refund", key: `late_payment:${args.paymentId}`,
    vars: { amount: rupees(args.amountPaise), outcome: args.ok ? "ok" : "failed", paymentRef: args.paymentRef },
  });
}

export async function onReminder(args: { reminderId: string; sendAtIso: string; appointmentId: string; hours: number }) {
  const c = await load(args.appointmentId);
  if (!c) return;
  await emit({
    userId: c.patientId, type: "reminder",
    key: `reminder:${args.reminderId}:${args.sendAtIso}`, // includes the send time, so a rescheduled reminder can fire again
    vars: {
      doctor: drName(c.doctorName), ...when(c),
      hours: `${args.hours} hour${args.hours === 1 ? "" : "s"}`,
    },
  });
}