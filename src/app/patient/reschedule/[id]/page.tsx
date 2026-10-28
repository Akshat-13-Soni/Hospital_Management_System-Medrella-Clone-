import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DateBlock } from "@/components/date-block";
import { SlotPicker } from "@/components/slot-picker";
import { requireRole } from "@/lib/auth-guard";
import { prettyDate } from "@/lib/format";
import { getPatientAppointment } from "@/lib/queries";
import { istNow } from "@/lib/slots";

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("patient");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const appt = await getPatientAppointment(id, s.userId);
  if (!appt || appt.status !== "booked") notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/patient" className="text-sm text-muted-foreground hover:text-foreground">
        ← My appointments
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Reschedule appointment</h1>
        <p className="text-sm text-muted-foreground">Pick a new date and time. Your current slot is released once you confirm.</p>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border bg-[#EAF5F1]/60 p-4">
        <DateBlock date={appt.date} />
        <div className="text-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Current appointment</p>
          <p className="font-semibold text-[#10231F]">{appt.doctorName}</p>
          <p>{prettyDate(appt.date)}, {appt.startTime}</p>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <SlotPicker doctorId={appt.doctorId} today={istNow().today} appointmentId={appt.id} />
      </div>
    </div>
  );
}