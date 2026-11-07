import { afterEach, describe, expect, it, vi } from "vitest";

// reminders.ts imports the database and other modules; only the pure function is tested here
vi.mock("@/db", () => ({ db: {} }));
vi.mock("./notify", () => ({ drName: (n: string) => n, fmtDate: (d: string) => d, notify: vi.fn() }));
vi.mock("./events", () => ({ onReminder: vi.fn() }));
vi.mock("./email", () => ({ emailConfigured: () => true, sendEmail: vi.fn() }));
vi.mock("./sms", () => ({ smsConfigured: () => true, sendSms: vi.fn() }));

import { isDeliverableEmail } from "./channels";
import { reminderHours } from "./reminders";

const original = process.env.REMINDER_HOURS;
afterEach(() => {
  if (original === undefined) delete process.env.REMINDER_HOURS;
  else process.env.REMINDER_HOURS = original;
});

describe("reminderHours", () => {
  it("defaults to 24 and 1 hours before", () => {
    delete process.env.REMINDER_HOURS;
    expect(reminderHours()).toEqual([24, 1]);
  });

  it("reads custom intervals from REMINDER_HOURS", () => {
    process.env.REMINDER_HOURS = "48, 24,1";
    expect(reminderHours()).toEqual([48, 24, 1]);
  });

  it("falls back to the default when the value is invalid", () => {
    process.env.REMINDER_HOURS = "abc,0,-5";
    expect(reminderHours()).toEqual([24, 1]);
  });
});

describe("isDeliverableEmail", () => {
  it("skips fake demo addresses and delivers real ones", () => {
    expect(isDeliverableEmail("ananya@demo.com")).toBe(false);
    expect(isDeliverableEmail("x@example.com")).toBe(false);
    expect(isDeliverableEmail("someone@test")).toBe(true);
    expect(isDeliverableEmail("patient@gmail.com")).toBe(true);
  });
});