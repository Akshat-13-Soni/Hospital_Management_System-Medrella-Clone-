import { toMin } from "../slots";

export function addDays(date: string, n: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// Slots nearest to the preferred time first; unchanged when no preference is given
export function closestFirst<T extends { startTime: string }>(slots: T[], preferred?: string) {
  if (!preferred) return slots;
  const p = toMin(preferred);
  return [...slots].sort((a, b) => Math.abs(toMin(a.startTime) - p) - Math.abs(toMin(b.startTime) - p));
}

// Appointments that overlap without starting together. Same-start bookings are wave seats, not conflicts.
export function findOverlaps<T extends { startTime: string; endTime: string }>(appts: T[]) {
  const out: [T, T][] = [];
  for (let i = 0; i < appts.length; i++) {
    for (let j = i + 1; j < appts.length; j++) {
      const a = appts[i], b = appts[j];
      if (a.startTime !== b.startTime && toMin(a.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(a.endTime)) {
        out.push([a, b]);
      }
    }
  }
  return out;
}