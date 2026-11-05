import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notificationPreferences } from "@/db/schema";

export type Prefs = {
  emailEnabled: boolean;
  smsEnabled: boolean;
  promoEmail: boolean;
  promoSms: boolean;
  phone: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  emailEnabled: true,
  smsEnabled: false, // SMS needs explicit opt-in
  promoEmail: false,
  promoSms: false,
  phone: null,
};

export async function getPrefs(userId: string): Promise<Prefs> {
  const [row] = await db.select().from(notificationPreferences).where(eq(notificationPreferences.userId, userId));
  if (!row) return DEFAULT_PREFS;
  return {
    emailEnabled: row.emailEnabled,
    smsEnabled: row.smsEnabled,
    promoEmail: row.promoEmail,
    promoSms: row.promoSms,
    phone: row.phone,
  };
}

// "9876543210" or "+919876543210" -> "+919876543210"; anything else -> null
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[\s()-]/g, "");
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  return null;
}