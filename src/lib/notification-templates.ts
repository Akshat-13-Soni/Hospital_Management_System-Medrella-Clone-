export type NotificationType =
  | "booking_confirmed"
  | "payment_confirmed"
  | "booking_new"
  | "rescheduled"
  | "rescheduled_doctor"
  | "cancelled"
  | "cancelled_doctor_notice"
  | "doctor_leave"
  | "refund_processed"
  | "refund_failed"
  | "late_payment_refund"
  | "reminder"
  | "generic";

export type Vars = Record<string, string | undefined>;

const T: Record<NotificationType, (v: Vars) => { subject: string; text: string }> = {
  booking_confirmed: (v) => ({
    subject: "Appointment confirmed",
    text: `Your appointment with ${v.doctor} on ${v.date} at ${v.time} is confirmed.`,
  }),
  payment_confirmed: (v) => ({
    subject: "Payment received and appointment confirmed",
    text: `Payment of ${v.amount} received. Your appointment with ${v.doctor} on ${v.date} at ${v.time} is confirmed.`,
  }),
  booking_new: (v) => ({
    subject: "New appointment",
    text: `New appointment: ${v.patient} on ${v.date} at ${v.time}.`,
  }),
  rescheduled: (v) => ({
    subject: "Appointment rescheduled",
    text: `Your appointment with ${v.doctor} is now on ${v.date} at ${v.time}.`,
  }),
  rescheduled_doctor: (v) => ({
    subject: "Appointment rescheduled",
    text: `${v.patient} rescheduled from ${v.oldDate} at ${v.oldTime} to ${v.date} at ${v.time}.`,
  }),
  cancelled: (v) => ({
    subject: "Appointment cancelled",
    text:
      (v.by === "doctor"
        ? `${v.doctor} cancelled your appointment on ${v.date} at ${v.time}.`
        : `You cancelled your appointment with ${v.doctor} on ${v.date} at ${v.time}.`) +
      (v.note ? ` ${v.note}` : ""),
  }),
  cancelled_doctor_notice: (v) => ({
    subject: "Appointment cancelled",
    text: `${v.patient} cancelled their appointment on ${v.date} at ${v.time}. The slot is free again.`,
  }),
  doctor_leave: (v) => ({
    subject: "Appointment cancelled: doctor unavailable",
    text:
      `${v.doctor} is unavailable on ${v.date}, so your appointment at ${v.time} has been cancelled.` +
      (v.note ? ` ${v.note}` : ""),
  }),
  refund_processed: (v) => ({
    subject: "Refund processed",
    text: `Your refund of ${v.amount} has been processed.`,
  }),
  refund_failed: (v) => ({
    subject: "Refund could not be completed",
    text: `Your refund of ${v.amount} could not be completed. Please contact support with payment ID ${v.paymentRef}.`,
  }),
  late_payment_refund: (v) => ({
    subject: "Payment refunded",
    text:
      v.outcome === "ok"
        ? `Your payment of ${v.amount} arrived after the slot was released, so it is being refunded in full.`
        : `Your payment of ${v.amount} arrived after the slot was released. Please contact support with payment ID ${v.paymentRef}.`,
  }),
  reminder: (v) => ({
    subject: "Appointment reminder",
    text: `Reminder: your appointment with ${v.doctor} is on ${v.date} at ${v.time}, in about ${v.hours}.`,
  }),
  generic: (v) => ({ subject: "Medrella update", text: v.text ?? "" }),
};

export function render(type: NotificationType, vars: Vars) {
  const { subject, text } = T[type](vars);
  // SMS: plain GSM characters keep messages short and cheap
  const sms = `Medrella: ${text}`.replace(/–/g, "-").replace(/₹/g, "Rs ");
  return { subject, text, sms };
}