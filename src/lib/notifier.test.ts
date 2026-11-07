import { describe, expect, it, vi } from "vitest";

// notifier.ts imports the database and Next.js; the functions tested here are pure
vi.mock("@/db", () => ({ db: {} }));
vi.mock("next/server", () => ({ after: (fn: () => void) => fn() }));

import { MAX_ATTEMPTS, planChannels, retryDelayMinutes } from "./notifier";
import type { Prefs } from "./preferences";

type Plan = Parameters<typeof planChannels>[0];
const configured = { email: true, sms: true } as Plan["configured"];

const prefs = (over: Partial<Prefs> = {}) =>
  ({ phone: "+919244833687", emailEnabled: true, smsEnabled: true, promoEmail: false, promoSms: false, ...over }) as Prefs;

const plan = (over: Partial<Plan> = {}) =>
  planChannels({ category: "operational", prefs: prefs(), email: "patient@gmail.com", configured, ...over });

describe("retryDelayMinutes (backoff)", () => {
  it("follows 1, 5, 15, 60, 240 minutes", () => {
    expect([1, 2, 3, 4, 5].map(retryDelayMinutes)).toEqual([1, 5, 15, 60, 240]);
  });

  it("stays at the longest delay and never goes below the first", () => {
    expect(retryDelayMinutes(99)).toBe(240);
    expect(retryDelayMinutes(0)).toBe(1);
  });

  it("gives up after 5 attempts", () => {
    expect(MAX_ATTEMPTS).toBe(5);
  });
});

describe("planChannels", () => {
  it("sends email and SMS when the person allows both", () => {
    const r = plan();
    expect(r.send.map((s) => s.channel)).toEqual(["email", "sms"]);
    expect(r.skipped).toEqual([]);
  });

  it("skips email when the person opted out", () => {
    const r = plan({ prefs: prefs({ emailEnabled: false }) });
    expect(r.send.map((s) => s.channel)).toEqual(["sms"]);
    expect(r.skipped).toEqual([{ channel: "email", reason: "opted_out" }]);
  });

  it("skips an undeliverable address such as @demo.com", () => {
    const r = plan({ email: "ananya@demo.com" });
    expect(r.skipped).toContainEqual({ channel: "email", reason: "undeliverable_address" });
  });

  it("skips SMS when it is off or there is no phone", () => {
    expect(plan({ prefs: prefs({ smsEnabled: false }) }).skipped).toContainEqual({ channel: "sms", reason: "opted_out" });
    expect(plan({ prefs: prefs({ phone: null }) }).skipped).toContainEqual({ channel: "sms", reason: "no_phone" });
  });

  it("blocks promotional messages unless the person opted in", () => {
    const off = plan({ category: "promotional" });
    expect(off.send).toEqual([]);
    expect(off.skipped.map((s) => s.reason)).toEqual(["opted_out", "opted_out"]);

    const on = plan({ category: "promotional", prefs: prefs({ promoEmail: true, promoSms: true }) });
    expect(on.send.map((s) => s.channel)).toEqual(["email", "sms"]);
  });

  it("ignores a channel that is not configured", () => {
    const r = plan({ configured: { email: true, sms: false } as Plan["configured"] });
    expect(r.send.map((s) => s.channel)).toEqual(["email"]);
    expect(r.skipped).toEqual([]);
  });
});