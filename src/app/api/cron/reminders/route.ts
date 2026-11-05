import { NextResponse } from "next/server";
import { releaseExpiredHolds } from "@/lib/payments";
import { processDueReminders } from "@/lib/reminders";
import { retryDueNotifications } from "@/lib/notifier";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const releasedHolds = await releaseExpiredHolds(); // also tidy up unpaid bookings
    const reminders = await processDueReminders();
    const retries = await retryDueNotifications();
        return NextResponse.json({ ok: true, releasedHolds, ...reminders, ...retries });
  } catch (err) {
    console.error("[cron] failed:", err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}