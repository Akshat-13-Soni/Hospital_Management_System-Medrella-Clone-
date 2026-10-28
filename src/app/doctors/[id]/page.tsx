import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { SlotPicker } from "@/components/slot-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SHORT_DAYS } from "@/lib/format";
import { getAvailability, getDoctor } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { istNow } from "@/lib/slots";

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const doc = await getDoctor(id);
  if (!doc) notFound();
  const [avail, session] = await Promise.all([getAvailability(id), getSession()]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between gap-2">
            {doc.name}
            <Badge variant="secondary">{doc.specialization}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{doc.experienceYears} years experience · ₹{doc.fee} per visit</p>
          {doc.clinicAddress && <p className="text-muted-foreground">{doc.clinicAddress}</p>}
          {doc.bio && <p>{doc.bio}</p>}
          <p className="pt-2 font-medium">Working hours</p>
          {avail.length === 0 ? (
            <p className="text-muted-foreground">This doctor has not set availability yet.</p>
          ) : (
            <ul className="text-muted-foreground">
              {avail.map((a) => (
                <li key={a.id}>
                  {SHORT_DAYS[a.dayOfWeek]}: {a.startTime} to {a.endTime} ({a.slotMinutes}-min slots)
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Book an appointment</CardTitle></CardHeader>
        <CardContent>
          {!session ? (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">Log in as a patient to book.</p>
              <div className="flex gap-2">
                <Link href="/login" className={buttonVariants({ size: "sm" })}>Log in</Link>
                <Link href="/signup" className={buttonVariants({ size: "sm", variant: "outline" })}>Sign up</Link>
              </div>
            </div>
          ) : session.role !== "patient" ? (
            <p className="text-sm text-muted-foreground">Doctor accounts cannot book appointments.</p>
          ) : (
            <SlotPicker doctorId={doc.id} today={istNow().today} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}