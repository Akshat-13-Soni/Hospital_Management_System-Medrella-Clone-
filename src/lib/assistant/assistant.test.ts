import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/actions/appointments", () => ({}));
vi.mock("@/lib/queries", () => ({}));
vi.mock("@/lib/leave", () => ({}));

import { addDays, closestFirst, findOverlaps } from "./slot-suggest";
import { getTool, toolsFor } from "./tools";

describe("tool scoping", () => {
  it("gives patients and doctors different tools", () => {
    const patient = toolsFor("patient").map((t) => t.name);
    const doctor = toolsFor("doctor").map((t) => t.name);
    expect(patient).toContain("book_appointment");
    expect(doctor).not.toContain("book_appointment");
    expect(patient).not.toContain("find_conflicts");
    expect(doctor).toContain("find_conflicts");
  });

  it("refuses to resolve another role's tool", () => {
    expect(getTool("find_conflicts", "patient")).toBeUndefined();
    expect(getTool("cancel_appointment", "doctor")).toBeUndefined();
  });

  it("makes every write tool confirmable and no read tool executable", () => {
    const writes = ["book_appointment", "reschedule_appointment", "cancel_appointment"];
    for (const t of toolsFor("patient")) expect(typeof t.execute === "function", t.name).toBe(writes.includes(t.name));
    for (const t of toolsFor("doctor")) expect(t.execute, t.name).toBeUndefined();
  });

  it("never lets the model name a user or a doctor to act as", () => {
    for (const t of toolsFor("patient")) {
      const keys = Object.keys((t.parameters as any).properties);
      expect(keys, t.name).not.toContain("userId");
      expect(keys, t.name).not.toContain("patientId");
    }
    for (const t of toolsFor("doctor")) {
      const keys = Object.keys((t.parameters as any).properties);
      expect(keys, t.name).not.toContain("doctorId");
      expect(keys, t.name).not.toContain("userId");
    }
  });

  it("rejects malformed arguments", () => {
    const book = getTool("book_appointment", "patient")!;
    expect(book.schema.safeParse({ doctorId: "not-a-uuid", date: "tomorrow", startTime: "10am" }).success).toBe(false);
  });
});

describe("slot helpers", () => {
  it("adds days across a month end", () => {
    expect(addDays("2026-11-29", 3)).toBe("2026-12-02");
  });
  it("orders slots by closeness to the wanted time", () => {
    const slots = [{ startTime: "09:00" }, { startTime: "11:30" }, { startTime: "10:00" }];
    expect(closestFirst(slots, "11:00").map((s) => s.startTime)).toEqual(["11:30", "10:00", "09:00"]);
  });
  it("flags overlapping bookings but not wave seats sharing a start", () => {
    const a = { startTime: "10:30", endTime: "11:00" };
    const b = { startTime: "10:00", endTime: "10:45" };
    const c = { startTime: "10:30", endTime: "11:00" };
    expect(findOverlaps([a, b])).toHaveLength(1);
    expect(findOverlaps([a, c])).toHaveLength(0);
  });
});