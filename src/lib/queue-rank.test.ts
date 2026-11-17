import { describe, expect, it } from "vitest";
import { nextTokenNo, positionOf, summarize, type QueueRow } from "./queue-rank";

const row = (id: string, tokenNo: number, status: QueueRow["status"] = "waiting"): QueueRow =>
  ({ id, tokenNo, status });

describe("queue ranking", () => {
  it("ranks waiting patients by token", () => {
    const rows = [row("b", 2), row("a", 1), row("c", 3)];
    expect(positionOf(rows, "a")).toBe(1);
    expect(positionOf(rows, "c")).toBe(3);
  });

  it("moves everyone up when someone cancels", () => {
    const rows = [row("a", 1), row("b", 2, "cancelled"), row("c", 3)];
    expect(positionOf(rows, "c")).toBe(2);
  });

  it("moves everyone up when someone is a no-show", () => {
    const rows = [row("a", 1, "no_show"), row("b", 2), row("c", 3)];
    expect(positionOf(rows, "b")).toBe(1);
  });

  it("has no position once called, completed, cancelled or no-show", () => {
    const rows = [row("a", 1, "in_consultation"), row("b", 2, "completed"), row("c", 3, "cancelled"), row("d", 4, "no_show")];
    for (const id of ["a", "b", "c", "d"]) expect(positionOf(rows, id)).toBeNull();
  });

  it("summarizes the current patient and the next in line", () => {
    const rows = [row("a", 1, "in_consultation"), row("b", 2), row("c", 3)];
    const s = summarize(rows);
    expect(s.current?.id).toBe("a");
    expect(s.next?.id).toBe("b");
    expect(s.waiting.map((r) => r.id)).toEqual(["b", "c"]);
  });

  it("handles an empty queue", () => {
    const s = summarize([]);
    expect(s.current).toBeNull();
    expect(s.next).toBeNull();
  });

  it("never reuses a token, even after cancellations", () => {
    expect(nextTokenNo([])).toBe(1);
    expect(nextTokenNo([{ tokenNo: 1 }, { tokenNo: 2 }, { tokenNo: 3 }])).toBe(4);
  });

  it("ignores no-shows that never got a token", () => {
    expect(nextTokenNo([{ tokenNo: null }, { tokenNo: 2 }])).toBe(3);
    expect(nextTokenNo([{ tokenNo: null }])).toBe(1);
  });

  it("promotes nobody while a patient is being seen", () => {
    const s = summarize([row("a", 1, "in_consultation"), row("b", 2)]);
    expect(s.current?.id).toBe("a");
    expect(s.next?.id).toBe("b");
  });
});