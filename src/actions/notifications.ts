"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getSession } from "@/lib/session";

export async function markAllRead() {
  const s = await getSession();
  if (!s) return;
  await db.update(notifications).set({ read: true })
    .where(and(eq(notifications.userId, s.userId), eq(notifications.read, false)));
  revalidatePath("/", "layout");
}