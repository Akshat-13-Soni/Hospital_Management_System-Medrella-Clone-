import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hoursUntil, refundFor } from "./refund-policy";

// "Now" is 10 Nov 2026, 10:00 IST
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-10T10:00:00+05:30"));
});
afterEach(() => vi.useRealTimers());

const patient = (date: string, startTime: string, amountPaise = 80000) =>
  refundFor({ date, startTime, cancelledBy: "patient", amountPaise });

describe("hoursUntil", () => {
  it("measures hours to the appointment in IST", () => {
    expect(hoursUntil("2026-11-10", "14:00")).toBe(4);
    expect(hoursUntil("2026-11-11", "10:00")).toBe(24);
  });
});

describe("patient cancellation tiers", () => {
  it("refunds 100% when more than 24 hours ahead", () => {
    const r = patient("2026-11-12", "10:00");
    expect(r.percent).toBe(100);
    expect(r.amountPaise).toBe(80000);
  });

  it("treats exactly 24 hours as the full-refund tier", () => {
    expect(patient("2026-11-11", "10:00").percent).toBe(100);
  });

  it("refunds 50% just under 24 hours", () => {
    const r = patient("2026-11-11", "09:59");
    expect(r.percent).toBe(50);
    expect(r.amountPaise).toBe(40000);
  });

  it("treats exactly 4 hours as the 50% tier", () => {
    expect(patient("2026-11-10", "14:00").percent).toBe(50);
  });

  it("refunds nothing under 4 hours", () => {
    const r = patient("2026-11-10", "13:59");
    expect(r.percent).toBe(0);
    expect(r.amountPaise).toBe(0);
  });

  it("refunds nothing for an appointment already in the past", () => {
    expect(patient("2026-11-09", "10:00").percent).toBe(0);
  });

  it("rounds a partial refund down to a whole paisa", () => {
    expect(patient("2026-11-11", "09:59", 999).amountPaise).toBe(499);
  });
});

describe("doctor cancellation", () => {
  it("always refunds in full, even at the last minute", () => {
    const r = refundFor({ date: "2026-11-10", startTime: "10:30", cancelledBy: "doctor", amountPaise: 80000 });
    expect(r.percent).toBe(100);
    expect(r.amountPaise).toBe(80000);
  });
});