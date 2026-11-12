"use server";
import { z } from "zod";
import { cancelPending, claimPending, finishAction } from "@/lib/assistant/pending";
import { getTool, type ExecResult } from "@/lib/assistant/tools";
import { getSession } from "@/lib/session";

const idSchema = z.string().uuid();

export async function confirmAssistantAction(id: string): Promise<ExecResult> {
  const session = await getSession();
  if (!session) return { ok: false, message: "Please sign in again." };
  if (!idSchema.safeParse(id).success) return { ok: false, message: "Invalid request." };

  // Only one caller can win this; a double click or replay gets a plain refusal
  const claim = await claimPending(id, session.userId);
  if (!claim.ok) {
    const why: Record<string, string> = {
      expired: "That confirmation expired. Please ask again.",
      not_found: "I could not find that request.",
      confirmed: "That was already done.",
      cancelled: "That request was cancelled.",
      failed: "That request did not go through. Please ask again.",
    };
    return { ok: false, message: why[claim.reason] ?? "That request is no longer valid." };
  }

  const tool = getTool(claim.row.tool, session.role);
  const args = tool?.schema.safeParse(claim.row.args);
  if (!tool?.execute || !args?.success) {
    await finishAction(id, false, "invalid action");
    return { ok: false, message: "That action is not allowed." };
  }

  // The tool's own code re-checks ownership, slot availability and status at this moment
  const res = await tool.execute({ userId: session.userId, role: session.role, name: session.name }, args.data);
  await finishAction(id, res.ok, res.message);
  return res;
}

export async function cancelAssistantAction(id: string) {
  const session = await getSession();
  if (!session || !idSchema.safeParse(id).success) return;
  await cancelPending(id, session.userId);
}