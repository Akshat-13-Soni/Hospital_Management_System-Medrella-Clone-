import { and, eq, gt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { assistantActions } from "@/db/schema";

export const CONFIRM_MINUTES = 5;

export async function createPending(userId: string, tool: string, args: unknown, summary: string) {
  // Only the newest proposal can be confirmed, so a stale card can never fire
  await db
    .update(assistantActions)
    .set({ status: "cancelled" })
    .where(and(eq(assistantActions.userId, userId), eq(assistantActions.status, "pending")));
  const [row] = await db
    .insert(assistantActions)
    .values({ userId, tool, args: args as object, summary, expiresAt: new Date(Date.now() + CONFIRM_MINUTES * 60_000) })
    .returning({ id: assistantActions.id });
  return row.id;
}

// Exactly one caller can win this update
export async function claimPending(id: string, userId: string) {
  const [row] = await db
    .update(assistantActions)
    .set({ status: "confirmed" })
    .where(
      and(
        eq(assistantActions.id, id),
        eq(assistantActions.userId, userId),
        eq(assistantActions.status, "pending"),
        gt(assistantActions.expiresAt, sql`now()`)
      )
    )
    .returning();
  if (row) return { ok: true as const, row };

  const [r] = await db
    .select()
    .from(assistantActions)
    .where(and(eq(assistantActions.id, id), eq(assistantActions.userId, userId)));
  if (!r) return { ok: false as const, reason: "not_found" as const };
  if (r.status === "pending") {
    await db
      .update(assistantActions)
      .set({ status: "expired" })
      .where(and(eq(assistantActions.id, id), eq(assistantActions.status, "pending"), lte(assistantActions.expiresAt, sql`now()`)));
    return { ok: false as const, reason: "expired" as const };
  }
  return { ok: false as const, reason: r.status as "confirmed" | "cancelled" | "expired" | "failed" };
}

export async function finishAction(id: string, ok: boolean, result: string) {
  await db
    .update(assistantActions)
    .set({ status: ok ? "confirmed" : "failed", result: result.slice(0, 500) })
    .where(eq(assistantActions.id, id));
}

export async function cancelPending(id: string, userId: string) {
  await db
    .update(assistantActions)
    .set({ status: "cancelled" })
    .where(and(eq(assistantActions.id, id), eq(assistantActions.userId, userId), eq(assistantActions.status, "pending")));
}