import { notFound } from "next/navigation";
import { z } from "zod";
import { SlotPicker } from "@/components/slot-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>Reschedule appointment</CardTitle>
        <p className="text-sm text-muted-foreground">
          {appt.doctorName} · currently {prettyDate(appt.date)}, {appt.startTime}
        </p>
      </CardHeader>
      <CardContent>
        <SlotPicker doctorId={appt.doctorId} today={istNow().today} appointmentId={appt.id} />
      </CardContent>
    </Card>
  );
}