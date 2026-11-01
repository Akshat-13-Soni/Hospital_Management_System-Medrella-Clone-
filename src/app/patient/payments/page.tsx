import Link from "next/link";
import { Receipt } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth-guard";
import { prettyDate } from "@/lib/format";
import { rupees } from "@/lib/money";
import { getPatientPayments } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { reconcilePendingRefunds } from "@/lib/refunds";

const payStyle: Record<string, string> = {
  paid: "bg-[#EAF5F1] text-[#0E6B58]",
  refunded: "bg-slate-100 text-slate-700",
  partially_refunded: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-700",
};
const payLabel: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  failed: "Failed",
};
const refundStyle: Record<string, string> = {
  pending: "text-amber-700",
  processed: "text-[#0E6B58]",
  failed: "text-red-700",
};
const refundLabel: Record<string, string> = {
  pending: "Refund in progress",
  processed: "Refund processed",
  failed: "Refund failed",
};

export default async function PaymentsPage() {
  const s = await requireRole("patient");
  await reconcilePendingRefunds(s.userId);
  const items = await getPatientPayments(s.userId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Payment history</h1>
          <p className="text-sm text-muted-foreground">Receipts and refund status for your consultations.</p>
        </div>
        <Link href="/patient" className={buttonVariants({ variant: "outline", size: "sm" })}>
          My appointments
        </Link>
      </div>

      {items.length === 0 && (
        <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5F1] text-[#0E6B58]">
            <Receipt className="h-6 w-6" />
          </span>
          <p className="font-medium text-[#10231F]">No payments yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Payments for booked consultations will show up here.</p>
        </div>
      )}

      {items.map((p) => (
        <article key={p.id} className="space-y-4 rounded-2xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[#10231F]">{p.doctorName}</p>
              <p className="text-sm text-muted-foreground">
                {p.specialization} · {prettyDate(p.date)}, {p.startTime} to {p.endTime}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold text-[#10231F]">{rupees(p.amountPaise)}</p>
              <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", payStyle[p.status])}>
                {payLabel[p.status] ?? p.status}
              </span>
            </div>
          </div>

          <dl className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">Receipt / payment ID</dt>
              <dd className="break-all font-mono text-xs">{p.providerPaymentId ?? "Not available"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paid on</dt>
              <dd>
                {p.paidAt
                  ? p.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })
                  : "Not completed"}
              </dd>
            </div>
          </dl>

          {p.refunds.length > 0 && (
            <ul className="space-y-2 border-t pt-3 text-sm">
              {p.refunds.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={cn("font-medium", refundStyle[r.status])}>
                      {refundLabel[r.status]}: {rupees(r.amountPaise)}
                    </p>
                    <p className="text-xs text-muted-foreground">{r.reason}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {(r.processedAt ?? r.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      dateStyle: "medium",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}