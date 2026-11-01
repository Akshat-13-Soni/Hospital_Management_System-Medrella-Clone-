import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { settleRefund } from "@/lib/refunds";
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
  const refund = event?.payload?.refund?.enitity;
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
      case "refund.processed":
        if(refund?.id)
          await settleRefund(refund.id, "processed", {providerPaymentId: refund.payment_id, amountPaise: refund.amount});
        break;
      case "refund.failed":
        if(refund?.id)
          await settleRefund(refund.id, "failed", {providerPaymentId: refund.payment_id, amountPaise: refund.amount});
        break;
      default:
        break;
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