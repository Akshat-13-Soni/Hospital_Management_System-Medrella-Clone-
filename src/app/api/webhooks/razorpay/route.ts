import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { webhookEvents } from "@/db/schema";
import { markFailed, markPaid } from "@/lib/payments";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const raw = await req.text(); // signature is computed over the raw body
  const signature = req.headers.get("x-razorpay-signature");
  if (!signature || !verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  const payment = event?.payload?.payment?.entity;
  const eventId: string =
    req.headers.get("x-razorpay-event-id") ?? `${event?.event}:${payment?.id ?? event?.created_at}`;

  try {
    const [seen] = await db.select().from(webhookEvents).where(eq(webhookEvents.eventId, eventId));
    if (seen) return NextResponse.json({ ok: true, duplicate: true });

    switch (event?.event) {
      case "payment.captured":
      case "order.paid":
        if (payment?.order_id && payment?.id) await markPaid(payment.order_id, payment.id);
        break;
      case "payment.failed":
        if (payment?.order_id) await markFailed(payment.order_id, payment.error_description);
        break;
      default:
        break; // other events are ignored for now
    }

    // Recorded only after successful processing, so a failed attempt gets retried
    await db
      .insert(webhookEvents)
      .values({ eventId, type: String(event?.event ?? "unknown") })
      .onConflictDoNothing();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}