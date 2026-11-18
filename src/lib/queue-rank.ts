export type QueueStatus = "waiting" | "in_consultation" | "completed" | "no_show" | "cancelled";
export type QueueRow = { id: string; tokenNo: number; status: QueueStatus };

export const isActiveStatus = (s: string) => s === "waiting" || s === "in_consultation";

// Tokens are never reused, even after a cancellation, so always count every row of the day.
export function nextTokenNo(rows: { tokenNo: number | null }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.tokenNo ?? 0), 0) + 1;
}

export function waitingInOrder<T extends QueueRow>(rows: T[]): T[] {
  return rows.filter((r) => r.status === "waiting").sort((a, b) => a.tokenNo - b.tokenNo);
}

// 1 = next in line. null when the entry is not waiting (being seen, done, cancelled, no-show).
export function positionOf(rows: QueueRow[], id: string): number | null {
  const i = waitingInOrder(rows).findIndex((r) => r.id === id);
  return i === -1 ? null : i + 1;
}

export function summarize<T extends QueueRow>(rows: T[]) {
  const waiting = waitingInOrder(rows);
  return {
    current: rows.find((r) => r.status === "in_consultation") ?? null,
    waiting,
    next: waiting[0] ?? null,
  };
}