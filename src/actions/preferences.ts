"use server";
import { sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";
import { normalizePhone } from "@/lib/preferences";
import { getSession } from "@/lib/session";

type State =
  | { success?: boolean; error?: string; fieldErrors?: { phone?: string[] } }
  | undefined;

export async function savePreferences(_prev: State, formData: FormData): Promise<State> {
  const s = await getSession();
  if (!s) return { error: "Please sign in" };

  const emailEnabled = formData.get("emailEnabled") === "on";
  const smsEnabled = formData.get("smsEnabled") === "on";
  const promoEmail = formData.get("promoEmail") === "on";
  const promoSms = formData.get("promoSms") === "on" && smsEnabled;

  const rawPhone = String(formData.get("phone") ?? "").trim();
  let phone: string | null = null;
  if (rawPhone) {
    phone = normalizePhone(rawPhone);
    if (!phone) return { fieldErrors: { phone: ["Enter a valid mobile number, like 9876543210 or +919876543210"] } };
  }
  if (smsEnabled && !phone) return { fieldErrors: { phone: ["Add a mobile number to receive SMS"] } };

  const values = { phone, emailEnabled, smsEnabled, promoEmail, promoSms, updatedAt: new Date() };
  await db
    .insert(notificationPreferences)
    .values({ userId: s.userId, ...values, smsConsentAt: smsEnabled ? new Date() : null })
    .onConflictDoUpdate({
      target: notificationPreferences.userId,
      set: {
        ...values,
        // keep the original consent time while SMS stays on; clear it when SMS is turned off
        smsConsentAt: smsEnabled ? sql`coalesce(${notificationPreferences.smsConsentAt}, now())` : null,
      },
    });

  revalidatePath("/settings/notifications");
  return { success: true };
}