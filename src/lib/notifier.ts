import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { notificationLog, notifications, users } from "@/db/schema";
import { channels, isDeliverableEmail, type ChannelName } from "./channels";
import { render, type NotificationType, type Vars } from "./notification-templates";
import { getPrefs, type Prefs } from "./preferences";

export const MAX_ATTEMPTS = 5;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

// Wait before retry number `attempts` (1-based)
export const retryDelayMinutes = (attempts: number) =>
  BACKOFF_MINUTES[Math.min(Math.max(attempts, 1), BACKOFF_MINUTES.length) - 1];

export type EmitInput = {
  userId: string;
  type: NotificationType;
  // Identifies the event. The same key for the same person can never produce a second message.
  key: string;
  vars: Vars;
  category?: "operational" | "promotional";
};

// Pure: which channels to try, and which to skip and why
export function planChannels(input: {
  category: "operational" | "promotional";
  prefs: Prefs;
  email: string;
  configured: Record<ChannelName, boolean>;
}) {
  const send: { channel: ChannelName; address: string }[] = [];
  const skipped: { channel: ChannelName; reason: string }[] = [];
  const promo = input.category === "promotional";

  if (input.configured.email) {
    const optedIn = promo ? input.prefs.promoEmail : input.prefs.emailEnabled;
    if (!optedIn) skipped.push({ channel: "email", reason: "opted_out" });
    else if (!isDeliverableEmail(input.email)) skipped.push({ channel: "email", reason: "undeliverable_address" });
    else send.push({ channel: "email", address: input.email });
  }

  if (input.configured.sms) {
    const optedIn = input.prefs.smsEnabled && (!promo || input.prefs.promoSms);
    if (!optedIn) skipped.push({ channel: "sms", reason: "opted_out" });
    else if (!input.prefs.phone) skipped.push({ channel: "sms", reason: "no_phone" });
    else send.push({ channel: "sms", address: input.prefs.phone });
  }
  return { send, skipped };
}

export async function emit(input: EmitInput) {
  const category = input.category ?? "operational";
  const msg = render(input.type, input.vars);
  const base = { userId: input.userId, type: input.type, category, idempotencyKey: input.key };

  // 1) In-app notification: always, and only once per event
  const [inApp] = await db
    .insert(notificationLog)
    .values({
      ...base, channel: "in_app", recipient: input.userId, subject: msg.subject,
      body: msg.text, status: "sent", sentAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  if (inApp) await db.insert(notifications).values({ userId: input.userId, message: msg.text });

  // 2) External channels, following the person's preferences
  const [u] = await db.select({ email: users.email }).from(users).where(eq(users.id, input.userId));
  if (!u) return;
  const prefs = await getPrefs(input.userId);
  const plan = planChannels({
    category, prefs, email: u.email,
    configured: { email: channels.email.configured(), sms: channels.sms.configured() },
  });

  for (const s of plan.skipped) {
    await db
      .insert(notificationLog)
      .values({
        ...base, channel: s.channel, recipient: s.channel === "email" ? u.email : (prefs.phone ?? "-"),
        subject: msg.subject, body: msg.text, status: "skipped", lastError: s.reason,
      })
      .onConflictDoNothing();
  }

  const created: string[] = [];
  for (const t of plan.send) {
    const [row] = await db
      .insert(notificationLog)
      .values({
        ...base, channel: t.channel, recipient: t.address, subject: msg.subject,
        body: t.channel === "sms" ? msg.sms : msg.text,
      })
      .onConflictDoNothing()
      .returning({ id: notificationLog.id });
    if (row) created.push(row.id); // no row means this event was already handled
  }
  if (created.length === 0) return;

  const run = async () => {
    await Promise.all(created.map((id) => deliver(id)));
  };
  try {
    after(run); // after the response, so a slow provider never slows the user
  } catch {
    await run(); // outside a request scope
  }
}

// One delivery attempt. A provider failure never throws into the booking flow.
export async function deliver(id: string) {
  const [row] = await db
    .update(notificationLog)
    .set({ status: "sending", attempts: sql`${notificationLog.attempts} + 1`, nextAttemptAt: new Date() })
    .where(and(eq(notificationLog.id, id), inArray(notificationLog.status, ["pending", "failed"])))
    .returning();
  if (!row) return; // someone else has it, or it is already sent

  const channel = row.channel === "sms" ? channels.sms : channels.email;
  try {
    const ref = await channel.send(row.recipient, { subject: row.subject ?? "Medrella update", text: row.body });
    await db
      .update(notificationLog)
      .set({ status: "sent", sentAt: new Date(), providerRef: ref ?? null, lastError: null })
      .where(eq(notificationLog.id, id));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[notify] ${row.channel} attempt ${row.attempts} failed:`, message);
    await db
      .update(notificationLog)
      .set({
        status: row.attempts >= MAX_ATTEMPTS ? "dead" : "failed",
        lastError: message.slice(0, 500),
        nextAttemptAt: new Date(Date.now() + retryDelayMinutes(row.attempts) * 60_000),
      })
      .where(eq(notificationLog.id, id));
  }
}

// Called by the cron endpoint: retries failed deliveries that are due
export async function retryDueNotifications(limit = 50) {
  // Recover rows left "sending" by a crashed run
  await db
    .update(notificationLog)
    .set({ status: "failed" })
    .where(and(eq(notificationLog.status, "sending"), lte(notificationLog.nextAttemptAt, sql`now() - interval '10 minutes'`)));

  const due = await db
    .select({ id: notificationLog.id })
    .from(notificationLog)
    .where(and(eq(notificationLog.status, "failed"), lte(notificationLog.nextAttemptAt, new Date())))
    .limit(limit);
  for (const d of due) await deliver(d.id);
  return { retried: due.length };
}