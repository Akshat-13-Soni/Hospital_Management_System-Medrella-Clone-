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

describe("openSlots capacity", () => {
  it("offers every seat when nothing is booked", () => {
    const r = openSlots(wave, none, false, 0);
    expect(r).toHaveLength(4);
    expect(r[0]).toMatchObject({ capacity: 3, seatsLeft: 3 });
  });
  it("shows the seats that are left", () => {
    const r = openSlots(wave, new Map([["10:00", 2]]), false, 0);
    expect(r.find((s) => s.startTime === "10:00")?.seatsLeft).toBe(1);
  });
  it("hides a slot once it is full", () => {
    const r = openSlots(wave, new Map([["10:00", 3]]), false, 0);
    expect(r.map((s) => s.startTime)).not.toContain("10:00");
  });
  it("hides a full stream", () => {
    expect(openSlots(stream, new Map([["10:00", 5]]), false, 0)).toEqual([]);
  });
  it("behaves like one patient per slot with capacity 1", () => {
    const one = { ...wave, capacity: 1 };
    expect(openSlots(one, new Map([["10:30", 1]]), false, 0).map((s) => s.startTime)).toEqual(["10:00", "11:00", "11:30"]);
  });
});

describe("openSlots today", () => {
  const nowMin = 10 * 60 + 45; // 10:45
  it("drops wave slots that have already started", () => {
    expect(openSlots(wave, none, true, nowMin).map((s) => s.startTime)).toEqual(["11:00", "11:30"]);
  });
  it("keeps a stream open until its window ends", () => {
    expect(openSlots(stream, none, true, nowMin)).toHaveLength(1);
    expect(openSlots(stream, none, true, 12 * 60)).toHaveLength(0);
  });
});