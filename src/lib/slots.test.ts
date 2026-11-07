import { describe, expect, it } from "vitest";
import { generateSlots, toHHMM, toMin, weekdayOf } from "./slots";

describe("time helpers", () => {
    it("converts HH:MM to minutes and back", () => {
        expect(toMin("10:30")).toBe(630);
        expect(toHHMM(630)).toBe("10:30");
        expect(toHHMM(65)).toBe("01:05");
    });

    it("finds the weekday of a date", () => {
        expect(weekdayOf("2026-11-01")).toBe(0);  //Sunday
        expect(weekdayOf("2026-11-06")).toBe(5);  //Friday
    });
});

describe("generateSlots", () => {
    it("splits a window into slots with start and end times", () => {
        expect(generateSlots("10:00", "11:30", 30)).toEqual([
            { startTime: "10:00", endTime: "10:30" },
            { startTime: "10:30", endTime: "11:00" },
            { startTime: "11:00", endTime: "11:30" },
        ]);
    });

    it("drops a last slot that would run past the end", () => {
        expect(generateSlots("10:00", "10:45", 30)).toEqual([{ startTime: "10:00", endTime: "10:30" }]);
    });

    it("return nothing when the winodw is shorter than one slot", () => {
        expect(generateSlots("10:00", "10:20", 30)).toEqual([]);
    });
});