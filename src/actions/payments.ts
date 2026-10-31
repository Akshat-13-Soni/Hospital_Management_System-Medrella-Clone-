"use server";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { appointments, payments } from "@/db/schema";
import { markPaid } from "@/lib/payments";
import { verifyCheckoutSignature } from "@/lib/razorpay";
import { getSession } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

const verifySchema = z.object({
  razorpay_order_id: z.string().min(1),
  razorpay_payment_id: z.string().min(1),
  razorpay_signature: z.string().min(1),
});

// The payment must belong to an appointment of the signed-in patient
async function ownedPayment(orderId: string, userId: string) {
  const [row] = await db
    .select({ id: payments.id, appointmentId: payments.appointmentId })
    .from(payments)
    .innerJoin(appointments, eq(appointments.id, payments.appointmentId))
    .where(and(eq(payments.providerOrderId, orderId), eq(appointments.patientId, userId)));
  return row ?? null;
}

function revalidateAll() {
  revalidatePath("/patient");
  revalidatePath("/doctor");
}

export async function verifyPayment(input: unknown): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== "patient") return { ok: false, error: "Please sign in" };

  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment response" };
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: sig } = parsed.data;

  if (!(await ownedPayment(orderId, session.userId))) return { ok: false, error: "Payment not found" };
  if (!verifyCheckoutSignature(orderId, paymentId, sig)) return { ok: false, error: "Payment signature could not be verified" };

  const res = await markPaid(orderId, paymentId);
  revalidateAll();
  return res.ok ? { ok: true } : { ok: false, error: "Could not confirm the payment" };
}

// Patient closed the checkout window without paying: release the slot right away
export async function abandonPayment(orderId: string): Promise<Result> {
  const session = await getSession();
  if (!session || session.role !== "patient") return { ok: false, error: "Please sign in" };

  const owned = await ownedPayment(orderId, session.userId);
  if (!owned) return { ok: false, error: "Payment not found" };

  const [changed] = await db
    .update(payments)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(and(eq(payments.id, owned.id), inArray(payments.status, ["created", "pending"])))
    .returning({ id: payments.id });

  if (changed) {
    await db
      .update(appointments)
      .set({ status: "cancelled", holdExpiresAt: null })
      .where(and(eq(appointments.id, owned.appointmentId), eq(appointments.status, "pending_payment")));
  }
  revalidateAll();
  return { ok: true };
}