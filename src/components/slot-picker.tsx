"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { bookAppointment, rescheduleAppointment } from "@/actions/appointments";
import { abandonPayment, verifyPayment } from "@/actions/payments";
import { fetchSlots } from "@/actions/slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prettyDate } from "@/lib/format";
import type { CheckoutInfo } from "@/lib/payment-types";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

type Slot = { startTime: string; endTime: string };

function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

// Resolves with "paid", "dismissed", or an error message
function runCheckout(c: CheckoutInfo): Promise<string> {
  return new Promise((resolve) => {
    const rz = new window.Razorpay({
      key: c.keyId,
      amount: c.amountPaise,
      currency: c.currency,
      order_id: c.orderId,
      name: "Medrella",
      description: `Consultation with ${c.doctorName}`,
      prefill: { name: c.patientName, email: c.patientEmail },
      theme: { color: "#0E6B58" },
      handler: async (r: any) => {
        const v = await verifyPayment(r);
        resolve(v.ok ? "paid" : v.error);
      },
      modal: { ondismiss: () => resolve("dismissed") },
    });
    rz.open();
  });
}

export function SlotPicker({
  doctorId, today, appointmentId, fee,
}: { doctorId: string; today: string; appointmentId?: string; fee?: number }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();
  const [paying, setPaying] = useState(false);

  const selectedSlot = slots.find((s) => s.startTime === selected) ?? null;
  const busy = pending || paying;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    fetchSlots(doctorId, date)
      .then((s) => { if (!cancelled) { setSlots(s); setLoading(false); } })
      .catch(() => { if (!cancelled) { setSlots([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [doctorId, date, reloadKey]);

  function refreshSlots() {
    setReloadKey((k) => k + 1);
  }

  function reschedule() {
    if (!selected || !appointmentId) return;
    setError(null);
    startTransition(async () => {
      const res = await rescheduleAppointment({ appointmentId, date, startTime: selected });
      if (res.ok) {
        router.push("/patient");
        router.refresh();
      } else {
        setError(res.error);
        refreshSlots();
      }
    });
  }

  async function book() {
    if (!selected) return;
    setError(null);
    setPaying(true);
    try {
      const res = await bookAppointment({ doctorId, date, startTime: selected, reason: reason.trim() || undefined });
      if (!res.ok) {
        setError(res.error);
        refreshSlots();
        return;
      }
      if (!res.checkout) {
        router.push("/patient");
        router.refresh();
        return;
      }

      if (!(await loadRazorpay())) {
        await abandonPayment(res.checkout.orderId);
        setError("Could not load the payment window. Check your connection and try again.");
        refreshSlots();
        return;
      }

      const outcome = await runCheckout(res.checkout);
      if (outcome === "paid") {
        router.push("/patient");
        router.refresh();
      } else if (outcome === "dismissed") {
        await abandonPayment(res.checkout.orderId);
        setError("Payment was cancelled, so the slot has been released.");
        refreshSlots();
      } else {
        // Verification failed on our side; the webhook may still confirm a real payment
        setError("We could not confirm your payment yet. If money was deducted, the booking will appear in My appointments shortly.");
      }
    } finally {
      setPaying(false);
    }
  }

  const confirm = appointmentId ? reschedule : book;
  const label = busy
    ? "Please wait..."
    : appointmentId
      ? "Confirm new time"
      : fee && fee > 0
        ? `Pay ₹${fee} and book`
        : "Confirm booking";

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div>
        <Label className="mb-2 block">Available slots</Label>
        {loading ? (
          <div className="grid grid-cols-2 gap-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">
            No slots available on this date. Try another day.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {slots.map((s) => {
              const active = selected === s.startTime;
              return (
                <button
                  key={s.startTime}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected(s.startTime)}
                  className={cn(
                    "h-9 rounded-md border text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B58] focus-visible:ring-offset-2",
                    active
                      ? "border-[#0E6B58] bg-[#0E6B58] text-white"
                      : "bg-background hover:border-[#0E6B58] hover:bg-[#EAF5F1]"
                  )}
                >
                  {s.startTime} – {s.endTime}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!appointmentId && (
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for visit (optional)</Label>
          <Textarea
            id="reason" rows={3} value={reason} maxLength={500}
            placeholder="Briefly describe your symptoms or concern"
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      )}

      {selectedSlot && (
        <dl className="grid grid-cols-3 gap-2 rounded-lg bg-[#EAF5F1] px-3 py-3 text-sm text-[#10231F]">
          <div>
            <dt className="text-xs text-muted-foreground">Date</dt>
            <dd className="font-semibold">{prettyDate(date)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Start</dt>
            <dd className="font-semibold">{selectedSlot.startTime}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">End</dt>
            <dd className="font-semibold">{selectedSlot.endTime}</dd>
          </div>
        </dl>
      )}

      {error && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        onClick={confirm}
        disabled={!selected || busy}
        className="w-full bg-[#0E6B58] text-white hover:bg-[#0B5646]"
      >
        {label}
      </Button>

      {!appointmentId && fee && fee > 0 ? (
        <p className="text-center text-xs text-muted-foreground">
          Your slot is held for 10 minutes while you pay.
        </p>
      ) : null}
    </div>
  );
}