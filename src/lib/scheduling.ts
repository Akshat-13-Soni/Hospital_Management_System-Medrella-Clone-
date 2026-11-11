import { generateSlots, toMin } from "./slots";

export type ScheduleType = "wave" | "stream";

export type ScheduleWindow = {
  type: ScheduleType;
  startTime: string;
  endTime: string;
  slotMinutes: number; // used by wave only
  capacity: number;
};

export type OpenSlot = { startTime: string; endTime: string; capacity: number; seatsLeft: number };

// Wave: the window is cut into slots. Stream: the whole window is one slot.
export function slotsFor(w: ScheduleWindow) {
  if (w.type === "stream") return [{ startTime: w.startTime, endTime: w.endTime }];
  return generateSlots(w.startTime, w.endTime, w.slotMinutes);
}

// taken: start time -> number of active appointments already holding a seat
export function openSlots(w: ScheduleWindow, taken: Map<string, number>, isToday: boolean, nowMin: number): OpenSlot[] {
  return slotsFor(w)
    .map((s) => ({ ...s, capacity: w.capacity, seatsLeft: w.capacity - (taken.get(s.startTime) ?? 0) }))
    .filter((s) => s.seatsLeft > 0)
    // a wave slot is gone once it starts; a stream stays open until its window ends
    .filter((s) => !isToday || (w.type === "stream" ? toMin(s.endTime) > nowMin : toMin(s.startTime) > nowMin));
}