import { createHash } from "node:crypto";
import { emit } from "./notifier";

// Fallback for free-text messages. Prefer the typed events in events.ts.
export async function notify(userId: string, message: string) {
  const hash = createHash("sha1").update(`${userId}|${message}`).digest("hex").slice(0, 16);
  const bucket = Math.floor(Date.now() / 600_000); // identical text within 10 minutes counts as a duplicate
  await emit({ userId, type: "generic", key: `generic:${hash}:${bucket}`, vars: { text: message } });
}

// "2026-10-27" -> "27/10/2026"
export const fmtDate = (d: string) => d.split("-").reverse().join("/");

export const drName = (n: string) => (/^dr\.?\s/i.test(n) ? n : `Dr. ${n}`);