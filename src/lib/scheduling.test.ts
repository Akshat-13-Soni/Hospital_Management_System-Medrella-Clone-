import { describe, expect, it } from "vitest";
import { openSlots, slotsFor, type ScheduleWindow } from "./scheduling";

const wave: ScheduleWindow = { type: "wave", startTime: "10:00", endTime: "12:00", slotMinutes: 30, capacity: 3 };
const stream: ScheduleWindow = { type: "stream", startTime: "10:00", endTime: "12:00", slotMinutes: 30, capacity: 5 };
const none = new Map<string, number>();

describe("slotsFor", () => {
  it("cuts a wave window into slots", () => {
    expect(slotsFor(wave).map((s) => s.startTime)).toEqual(["10:00", "10:30", "11:00", "11:30"]);
  });
  it("makes a stream one slot spanning the window", () => {
    expect(slotsFor(stream)).toEqual([{ startTime: "10:00", endTime: "12:00" }]);
  });
});

const appt = (startTime: string, endTime: string) => ({ startTime, endTime });

describe("openSlots capacity", () => {
  it("offers every seat when nothing is booked", () => {
    const r = openSlots(wave, [], false, 0);
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ capacity: 3, seatsLeft: 3 });
  });
  it("shows the seats that are left", () => {
    const r = openSlots(wave, [appt("10:00", "10:30"), appt("10:00", "10:30")], false, 0);
    expect(r.find((s) => s.startTime === "10:00")?.seatsLeft).toBe(1);
  });
  it("hides a slot once it is full", () => {
    const full = [appt("10:00", "10:30"), appt("10:00", "10:30"), appt("10:00", "10:30")];
    expect(openSlots(wave, full, false, 0).map((s) => s.startTime)).not.toContain("10:00");
  });
  it("hides a full stream", () => {
    const busy = Array.from({ length: 5 }, () => appt("10:00", "12:00"));
    expect(openSlots(stream, busy, false, 0)).toEqual([]);
  });
  it("behaves like one patient per slot with capacity 1", () => {
    const one = { ...wave, capacity: 1 };
    expect(openSlots(one, [appt("10:30", "11:00")], false, 0).map((s) => s.startTime)).toEqual(["10:00", "11:00", "11:30"]);
  });
});

describe("openSlots today", () => {
  const nowMin = 10 * 60 + 45;
  it("drops wave slots that have already started", () => {
    expect(openSlots(wave, [], true, nowMin).map((s) => s.startTime)).toEqual(["11:00", "11:30"]);
  });
  it("keeps a stream open until its window ends", () => {
    expect(openSlots(stream, [], true, nowMin)).toHaveLength(1);
    expect(openSlots(stream, [], true, 12 * 60)).toHaveLength(0);
  });
});

describe("elastic scheduling", () => {
  const one: ScheduleWindow = { type: "wave", startTime: "10:00", endTime: "12:00", slotMinutes: 30, capacity: 1 };

  it("shrinking the window removes slots outside it and keeps the rest", () => {
    const shrunk = { ...one, endTime: "11:00" };
    expect(openSlots(shrunk, [], false, 0).map((s) => s.startTime)).toEqual(["10:00", "10:30"]);
  });
  it("expanding the window adds slots without touching existing bookings", () => {
    const expanded = { ...one, startTime: "09:00" };
    const r = openSlots(expanded, [appt("10:00", "10:30")], false, 0).map((s) => s.startTime);
    expect(r).toContain("09:00");
    expect(r).not.toContain("10:00"); // the booked slot stays taken
  });
  it("hides a new slot that overlaps a booking left over from the old slot length", () => {
    const longer = { ...one, slotMinutes: 45 }; // new slots: 10:00-10:45, 10:45-11:30
    const r = openSlots(longer, [appt("10:30", "11:00")], false, 0).map((s) => s.startTime);
    expect(r).not.toContain("10:00");
    expect(r).not.toContain("10:45");
  });
  it("keeps a booking outside the shrunk window from showing as an open slot", () => {
    const shrunk = { ...one, endTime: "11:00" };
    const r = openSlots(shrunk, [appt("11:30", "12:00")], false, 0).map((s) => s.startTime);
    expect(r).toEqual(["10:00", "10:30"]);
  });
});