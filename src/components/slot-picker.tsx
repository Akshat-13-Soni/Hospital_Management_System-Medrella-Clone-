"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { bookAppointment, rescheduleAppointment } from "@/actions/appointments";
import { fetchSlots } from "@/actions/slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
    <div className="space-y-4">
      <div className="max-w-xs space-y-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      <div>
        <Label className="mb-2 block">Available slots</Label>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading slots...</p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No slots available on this date. Try another day.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {slots.map((s) => (
              <Button
                key={s.startTime} type="button" size="sm"
                variant={selected === s.startTime ? "default" : "outline"}
                onClick={() => setSelected(s.startTime)}
              >
                {s.startTime}
              </Button>
            ))}
          </div>
        )}
      </div>

      {!appointmentId && (
        <div className="space-y-2">
          <Label htmlFor="reason">Reason for visit (optional)</Label>
          <Textarea id="reason" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={confirm} disabled={!selected || pending}>
        {pending ? "Saving..." : appointmentId ? "Confirm new time" : "Confirm booking"}
      </Button>
    </div>
  );
}