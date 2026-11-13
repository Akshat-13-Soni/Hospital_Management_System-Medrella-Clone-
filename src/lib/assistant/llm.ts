export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ChatMsg =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolDef = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export const llmConfigured = () => !!(process.env.AI_BASE_URL && process.env.AI_API_KEY && process.env.AI_MODEL);

// One call to any OpenAI-compatible chat completions endpoint
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Rate limits (429) and provider errors (5xx) are retried twice with a short wait.
export async function chatCompletion(messages: ChatMsg[], tools: ToolDef[]) {
  let lastError = "AI provider unavailable";
  for (let attempt = 0; attempt < 3; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25_000);
    try {
      const res = await fetch(`${process.env.AI_BASE_URL!.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.AI_API_KEY}` },
        body: JSON.stringify({ model: process.env.AI_MODEL, messages, tools, temperature: 0.2, max_tokens: 600 }),
        signal: ctrl.signal,
      });

      if (res.ok) {
        const data = await res.json();
        const msg = data?.choices?.[0]?.message;
        if (!msg) throw new Error("AI provider returned no message");
        return msg as { content: string | null; tool_calls?: ToolCall[] };
      }

      const detail = (await res.text().catch(() => "")).slice(0, 300);
      lastError = `AI provider returned ${res.status}: ${detail}`;
      const retryable = res.status === 429 || res.status >= 500 || (res.status === 400 && detail.includes("tool_use_failed"));
      if (!retryable || attempt === 2) throw new Error(lastError);
      const asked = Number(res.headers.get("retry-after")) * 1000;
      await sleep(Math.min(asked || 1500 * (attempt + 1), 8000));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}