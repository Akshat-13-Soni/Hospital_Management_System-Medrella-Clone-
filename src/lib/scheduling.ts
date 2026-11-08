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

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) =>
  toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

// busy: every active appointment that day. Same-start bookings are handled by the seat count,
// but a booking that starts at a different time and overlaps a wave slot blocks that slot.
// A stream holds many patients across its window, so overlaps are expected there.
export function openSlots(
  w: ScheduleWindow,
  busy: { startTime: string; endTime: string }[],
  isToday: boolean,
  nowMin: number
): OpenSlot[] {
  const taken = new Map<string, number>();
  for (const b of busy) taken.set(b.startTime, (taken.get(b.startTime) ?? 0) + 1);

  return slotsFor(w)
    .map((s) => ({ ...s, capacity: w.capacity, seatsLeft: w.capacity - (taken.get(s.startTime) ?? 0) }))
    .filter((s) => s.seatsLeft > 0)
    .filter(
      (s) =>
        w.type === "stream" ||
        !busy.some((b) => b.startTime !== s.startTime && overlaps(s.startTime, s.endTime, b.startTime, b.endTime))
    )
    .filter((s) => !isToday || (w.type === "stream" ? toMin(s.endTime) > nowMin : toMin(s.startTime) > nowMin));
}