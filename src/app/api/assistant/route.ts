import { NextResponse } from "next/server";
import { z } from "zod";
import { chatCompletion, llmConfigured, type ChatMsg } from "@/lib/assistant/llm";
import { createPending } from "@/lib/assistant/pending";
import { systemPrompt } from "@/lib/assistant/prompt";
import { getTool, toolsFor, type Ctx } from "@/lib/assistant/tools";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STEPS = 5;
const body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(1500) })).min(1).max(20),
});

// Simple per-process limiter. It is a cost guard, not a security boundary.
const hits = new Map<string, number[]>();
function limited(userId: string) {
  const now = Date.now();
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 10 * 60_000);
  recent.push(now);
  hits.set(userId, recent);
  return recent.length > 30;
}

type State = { pending: { id: string; summary: string } | null };
const fail = (error: string) => JSON.stringify({ error });

async function runCall(name: string, rawArgs: string, ctx: Ctx, state: State) {
  const tool = getTool(name, ctx.role); // a tool outside the user's role simply does not exist
  if (!tool) return fail("Unknown tool");

  let json: unknown;
  try {
    json = JSON.parse(rawArgs || "{}");
  } catch {
    return fail("Invalid arguments");
  }
  const parsed = tool.schema.safeParse(json);
  if (!parsed.success) return fail(parsed.error.issues.map((i) => i.message).join("; "));

  try {
    const out: any = await tool.run(ctx, parsed.data);
    if (!tool.execute) return JSON.stringify(out).slice(0, 4000);

    // Write tools only propose. The change happens when the user confirms.
    if (out?.error) return JSON.stringify(out);
    if (state.pending) return fail("Only one change at a time. Ask the user to confirm or cancel the current one first.");
    const id = await createPending(ctx.userId, tool.name, parsed.data, out.summary);
    state.pending = { id, summary: out.summary };
    return JSON.stringify({ status: "awaiting_user_confirmation", note: "Nothing has changed yet. Tell the user to review and confirm." });
  } catch (err) {
    console.error(`[assistant] tool ${name} failed:`, err);
    return fail("That request failed");
  }
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  if (!llmConfigured()) return NextResponse.json({ error: "The assistant is not set up yet." }, { status: 503 });
  if (limited(session.userId)) return NextResponse.json({ error: "Too many requests. Please wait a few minutes." }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const ctx: Ctx = { userId: session.userId, role: session.role, name: session.name };
  const defs = toolsFor(ctx.role).map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const messages: ChatMsg[] = [{ role: "system", content: systemPrompt(ctx.role, ctx.name) }, ...parsed.data.messages];
  const state: State = { pending: null };

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const msg = await chatCompletion(messages, defs);
      if (!msg.tool_calls?.length) return NextResponse.json({ reply: msg.content ?? "", pending: state.pending });

      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      for (const call of msg.tool_calls) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: await runCall(call.function.name, call.function.arguments, ctx, state),
        });
      }
    }
    return NextResponse.json({ reply: "I could not finish that. Could you say it another way?", pending: state.pending });
  } catch (err) {
    console.error("[assistant] failed:", err);
    return NextResponse.json(
      {
        error: "The assistant is unavailable right now. Please try again.",
        // Only while developing; never sent from a production deployment
        ...(process.env.NODE_ENV !== "production" && { debug: String(err).slice(0, 400) }),
      },
      { status: 502 }
    );
  }
}