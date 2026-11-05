import { and, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { appointments, payments, refunds } from "@/db/schema";
import { rupees } from "./money";
import { notify } from "./notify";
import { getRazorpay } from "./razorpay";
import { onRefundSettled } from "./events";

type IssueResult = { ok: true; refundId: string } | { ok: false; error: string };

export async function issueRefund(input: {
  paymentId: string;
  amountPaise: number;
  reason: string;
}): Promise<IssueResult> {
  const [p] = await db.select().from(payments).where(eq(payments.id, input.paymentId));
  if (!p || !p.providerPaymentId) return { ok: false, error: "Payment not found" };
  if (p.status !== "paid") return { ok: false, error: "Payment is not refundable" };

  // Never refund the same payment twice
  const existing = await db
    .select({ id: refunds.id })
    .from(refunds)
    .where(and(eq(refunds.paymentId, p.id), inArray(refunds.status, ["pending", "processed"])));
  if (existing.length > 0) return { ok: false, error: "A refund already exists for this payment" };

  const amount = Math.min(input.amountPaise, p.amountPaise);
  if (amount <= 0) return { ok: false, error: "Nothing to refund" };

  const [row] = await db
    .insert(refunds)
    .values({ paymentId: p.id, amountPaise: amount, reason: input.reason })
    .returning({ id: refunds.id });

  let gateway: { id: string; status: string };
  try {
    const { client } = getRazorpay();
    gateway = await client.payments.refund(p.providerPaymentId, {
      amount,
      speed: "normal",
      receipt: row.id,
      notes: { refundId: row.id },
    });
  } catch (err) {
    console.error("[refunds] gateway refund failed:", err);
    await db.update(refunds).set({ status: "failed" }).where(eq(refunds.id, row.id));
    return { ok: false, error: "The gateway rejected the refund" };
  }

  await db.update(refunds).set({ providerRefundId: gateway.id }).where(eq(refunds.id, row.id));
  if (gateway.status === "processed") await settleRefund(gateway.id, "processed");
  return { ok: true, refundId: row.id };
}

// Recomputes a payment's status from its processed refunds. Safe to run any time.
async function syncPaymentStatus(paymentId: string) {
  const [p] = await db.select().from(payments).where(eq(payments.id, paymentId));
  if (!p || (p.status !== "paid" && p.status !== "partially_refunded")) return;

  const [{ total }] = await db
    .select({ total: sql<number>`coalesce(sum(${refunds.amountPaise}), 0)::int` })
    .from(refunds)
    .where(and(eq(refunds.paymentId, paymentId), eq(refunds.status, "processed")));
  if (total <= 0) return;

  const next = total >= p.amountPaise ? "refunded" : "partially_refunded";
  if (next !== p.status) {
    await db.update(payments).set({ status: next, updatedAt: new Date() }).where(eq(payments.id, paymentId));
  }
}

// Called from the webhook (and right after a refund that completes instantly).
// Safe to call many times for the same refund.
export async function settleRefund(
  providerRefundId: string,
  status: "processed" | "failed",
  info?: { providerPaymentId?: string; amountPaise?: number }
) {
  let row = (await db.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)))[0];

  if (!row && info?.providerPaymentId) {
    const [p] = await db.select().from(payments).where(eq(payments.providerPaymentId, info.providerPaymentId));
    if (p) {
      // The webhook can beat our own update: attach to the refund we just created
      const inflight =
        info.amountPaise !== undefined
          ? (
              await db
                .select()
                .from(refunds)
                .where(
                  and(
                    eq(refunds.paymentId, p.id),
                    isNull(refunds.providerRefundId),
                    eq(refunds.status, "pending"),
                    eq(refunds.amountPaise, info.amountPaise)
                  )
                )
            )[0]
          : undefined;

      if (inflight) {
        row = (
          await db.update(refunds).set({ providerRefundId }).where(eq(refunds.id, inflight.id)).returning()
        )[0];
      } else {
        // A refund started from the Razorpay dashboard
        await db
          .insert(refunds)
          .values({
            paymentId: p.id,
            amountPaise: info.amountPaise ?? p.amountPaise,
            reason: "Refund issued from the payment dashboard",
            status: "pending",
            providerRefundId,
          })
          .onConflictDoNothing();
        row = (await db.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)))[0];
      }
    }
  }
  if (!row) return;

  // Already settled (duplicate event): just make sure the payment label is right
  if (row.status === status) {
    if (status === "processed") await syncPaymentStatus(row.paymentId);
    return;
  }

  // Only a pending refund can move forward
  const [moved] = await db
    .update(refunds)
    .set({ status, processedAt: status === "processed" ? new Date() : null })
    .where(and(eq(refunds.id, row.id), eq(refunds.status, "pending")))
    .returning();
  if (!moved) return;

  const [p] = await db.select().from(payments).where(eq(payments.id, row.paymentId));
  if (!p) return;
  const [appt] = await db
    .select({ patientId: appointments.patientId })
    .from(appointments)
    .where(eq(appointments.id, p.appointmentId));

  if (status === "processed") {
    await syncPaymentStatus(p.id);
    if(appt)
      await onRefundSettled({
    userId: appt.patientId, refundId: row.id, status: "processed",
  amountPaise: row.amountPaise, paymentRef: p.providerPaymentId,
});
  }
  else if(appt){
    await onRefundSettled({
      userId: appt.patientId, refundId: row.id, status: "failed",
      amountPaise: row.amountPaise, paymentRef: p.providerPaymentId,
    });
  }
}

// Webhooks can be missed, so ask the gateway directly about refunds still pending,
// and repair any payment label that disagrees with its processed refunds.
export async function reconcilePendingRefunds(patientId: string) {
  const owned = and(eq(appointments.patientId, patientId));

  const pending = await db
    .select({ providerRefundId: refunds.providerRefundId })
    .from(refunds)
    .innerJoin(payments, eq(payments.id, refunds.paymentId))
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .where(and(owned, eq(refunds.status, "pending"), isNotNull(refunds.providerRefundId)));

  if (pending.length > 0) {
    const { client } = getRazorpay();
    for (const r of pending) {
      try {
        const g = await client.refunds.fetch(r.providerRefundId!);
        if (g.status === "processed") await settleRefund(r.providerRefundId!, "processed");
        else if (g.status === "failed") await settleRefund(r.providerRefundId!, "failed");
      } catch (err) {
        console.error("[refunds] reconcile failed:", err);
      }
    }
  }

  const stale = await db
    .selectDistinct({ id: payments.id })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .innerJoin(refunds, and(eq(refunds.paymentId, payments.id), eq(refunds.status, "processed")))
    .where(and(owned, inArray(payments.status, ["paid", "partially_refunded"])));
  for (const s of stale) await syncPaymentStatus(s.id);
}