"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { bookAppointment, rescheduleAppointment } from "@/actions/appointments";
import { fetchSlots } from "@/actions/slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { prettyDate } from "@/lib/format";
import { cn } from "@/lib/utils";

type Slot = { startTime: string; endTime: string };

export function SlotPicker({
  doctorId, today, appointmentId,
}: { doctorId: string; today: string; appointmentId?: string }) {
  const router = useRouter();
  const [date, setDate] = useState(today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pending, startTransition] = useTransition();

  const selectedSlot = slots.find((s) => s.startTime === selected) ?? null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSelected(null);
    fetchSlots(doctorId, date)
      .then((s) => { if (!cancelled) { setSlots(s); setLoading(false); } })
      .catch(() => { if (!cancelled) { setSlots([]); setLoading(false); } });
    return () => { cancelled = true; };
  }, [doctorId, date, reloadKey]);

  function confirm() {
    if (!selected) return;
    setError(null);
    startTransition(async () => {
      const res = appointmentId
        ? await rescheduleAppointment({ appointmentId, date, startTime: selected })
        : await bookAppointment({ doctorId, date, startTime: selected, reason: reason.trim() || undefined });
      if (res.ok) {
        router.push("/patient");
        router.refresh();
      } else {
        setError(res.error);
        setReloadKey((k) => k + 1); // refresh slots in case someone took one
      }
    });
  }

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
        disabled={!selected || pending}
        className="w-full bg-[#0E6B58] text-white hover:bg-[#0B5646]"
      >
        {pending
          ? "Saving..."
          : appointmentId
            ? "Confirm new time"
            : "Confirm booking"}
      </Button>
    </div>
  );
}