import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { appointments, payments } from "@/db/schema";
import { onCancelled, onDoctorLeave } from "./events";
import { rupees } from "./money";
import { refundFor } from "./refund-policy";
import { issueRefund } from "./refunds";
import { cancelReminders } from "./reminders";

export async function cancelBooked(input: { appointmentId: string; by: "patient" | "doctor" | "leave" }) {
  // Only one caller can win this update, so nothing below can run twice
  const [a] = await db
    .update(appointments)
    .set({ status: "cancelled" })
    .where(and(eq(appointments.id, input.appointmentId), eq(appointments.status, "booked")))
    .returning({ id: appointments.id, date: appointments.date, startTime: appointments.startTime });
  if (!a) return false;

  await cancelReminders(a.id);

  let note = "";
  const [pay] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.appointmentId, a.id), eq(payments.status, "paid")));
  if (pay) {
    const d = refundFor({
      date: a.date,
      startTime: a.startTime,
      cancelledBy: input.by === "patient" ? "patient" : "doctor", // leave refunds in full, like a doctor cancel
      amountPaise: pay.amountPaise,
    });
    if (d.amountPaise > 0) {
      const res = await issueRefund({ paymentId: pay.id, amountPaise: d.amountPaise, reason: d.reason });
      note = res.ok
        ? `A refund of ${rupees(d.amountPaise)} (${d.percent}%) has been initiated. You can track it in Payment history.`
        : `We could not start your refund automatically. Please contact support with payment ID ${pay.providerPaymentId}.`;
    } else {
      note = "No refund applies under the cancellation policy.";
    }
  }

  if (input.by === "leave") await onDoctorLeave(a.id, note);
  else await onCancelled(a.id, { by: input.by, note });
  return true;
}