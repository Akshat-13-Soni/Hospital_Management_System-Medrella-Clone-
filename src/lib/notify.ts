import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(userId: string, message: string) {
  await db.insert(notifications).values({ userId, message });
}

// "2026-10-27" -> "27/10/2026"
export const fmtDate = (d: string) => d.split("-").reverse().join("/");

export const drName = (n: string) => (/^dr\.?\s/i.test(n) ? n : `Dr. ${n}`);