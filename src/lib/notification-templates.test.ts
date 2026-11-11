import { describe, expect, it } from "vitest";
import { render, type NotificationType } from "./notification-templates";

const types: NotificationType[] = [
  "booking_confirmed", "payment_confirmed", "booking_new", "rescheduled", "rescheduled_doctor",
  "cancelled", "cancelled_doctor_notice", "doctor_leave", "refund_processed", "refund_failed",
  "late_payment_refund", "reminder", "generic",
];

const vars = {
  doctor: "Dr. Ananya Rao", patient: "Akshat", date: "10/11/2026", time: "13:00 – 14:00",
  oldDate: "09/11/2026", oldTime: "10:00", amount: "₹800", paymentRef: "pay_123", hours: "1 hour",
  note: "A refund has been initiated.", outcome: "ok", by: "doctor", text: "hello",
};

describe("render", () => {
  it("renders every template with a subject and text", () => {
    for (const t of types) {
      const r = render(t, vars);
      expect(r.subject.length, t).toBeGreaterThan(0);
      expect(r.text.length, t).toBeGreaterThan(0);
      expect(r.text, t).not.toContain("undefined");
    }
  });

  it("never includes the reason for the visit or other medical detail", () => {
    for (const t of types) {
      const r = render(t, { ...vars, reason: "SECRET-SYMPTOMS", diagnosis: "SECRET-DIAGNOSIS" });
      expect(`${r.subject} ${r.text} ${r.sms}`, t).not.toMatch(/SECRET/);
    }
  });

  it("builds a plain-character SMS", () => {
    const r = render("payment_confirmed", vars);
    expect(r.sms.startsWith("Medrella: ")).toBe(true);
    expect(r.sms).toContain("Rs 800");
    expect(r.sms).not.toContain("₹");
    expect(r.sms).not.toContain("–");
  });

  it("words a doctor cancel and a patient cancel differently", () => {
    expect(render("cancelled", { ...vars, by: "doctor" }).text).toContain("Dr. Ananya Rao cancelled your appointment");
    expect(render("cancelled", { ...vars, by: "patient" }).text).toContain("You cancelled your appointment");
  });

  it("explains a doctor-leave cancellation", () => {
    const r = render("doctor_leave", vars);
    expect(r.subject).toContain("doctor unavailable");
    expect(r.text).toContain("has been cancelled");
  });

  it("gives the manual-help message when a late-payment refund fails", () => {
    expect(render("late_payment_refund", { ...vars, outcome: "failed" }).text).toContain("pay_123");
    expect(render("late_payment_refund", { ...vars, outcome: "ok" }).text).toContain("refunded in full");
  });
});