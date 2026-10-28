export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const toHHMM = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export function generateSlots(start: string, end: string, step: number) {
  const out: { startTime: string; endTime: string }[] = [];
  for (let t = toMin(start); t + step <= toMin(end); t += step) {
    out.push({ startTime: toHHMM(t), endTime: toHHMM(t + step) });
  }
  return out;
}

export const weekdayOf = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay();

// Clinic time is IST, so "past slot" checks must not depend on server timezone
export function istNow() {
  const now = new Date();
  const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hhmm = now.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
  return { today, nowMin: toMin(hhmm) };
}