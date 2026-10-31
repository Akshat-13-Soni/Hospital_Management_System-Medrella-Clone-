import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { SlotPicker } from "@/components/slot-picker";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SHORT_DAYS } from "@/lib/format";
import { getAvailability, getDoctor } from "@/lib/queries";
import { getSession } from "@/lib/session";
import { istNow } from "@/lib/slots";
import { cn } from "@/lib/utils";

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const doc = await getDoctor(id);
  if (!doc) notFound();
  const [avail, session] = await Promise.all([getAvailability(id), getSession()]);

  return (
    <div className="space-y-4">
      <Link href="/doctors" className="text-sm text-muted-foreground hover:text-foreground">
        ← All doctors
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Profile */}
        <div className="space-y-6">
          <div className="rounded-2xl border bg-card p-6">
            <div className="flex items-start gap-4">
              <DoctorAvatar name={doc.name} className="h-16 w-16 text-xl" />
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">{doc.name}</h1>
                <Badge variant="secondary" className="mt-1 bg-[#EAF5F1] text-[#0E6B58]">
                  {doc.specialization}
                </Badge>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 border-t pt-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Experience</dt>
                <dd className="font-semibold text-[#10231F]">{doc.experienceYears} years</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Consultation fee</dt>
                <dd className="font-semibold text-[#10231F]">₹{doc.fee}</dd>
              </div>
            </dl>

            {doc.bio && (
              <div className="mt-4 border-t pt-4">
                <h2 className="mb-1 text-sm font-semibold text-[#10231F]">About</h2>
                <p className="text-sm text-muted-foreground">{doc.bio}</p>
              </div>
            )}
            {doc.clinicAddress && (
              <div className="mt-4 border-t pt-4">
                <h2 className="mb-1 text-sm font-semibold text-[#10231F]">Clinic</h2>
                <p className="text-sm text-muted-foreground">{doc.clinicAddress}</p>
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-card p-6">
            <h2 className="mb-3 text-sm font-semibold text-[#10231F]">Working hours</h2>
            {avail.length === 0 ? (
              <p className="text-sm text-muted-foreground">This doctor has not set availability yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {avail.map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2">
                    <span className="font-medium">{SHORT_DAYS[a.dayOfWeek]}</span>
                    <span className="text-muted-foreground">
                      {a.startTime} to {a.endTime} · {a.slotMinutes}-min slots
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Booking panel */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-semibold text-[#10231F]">Book an appointment</h2>
              <span className="text-sm text-muted-foreground">₹{doc.fee}</span>
            </div>

            {!session ? (
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">Log in as a patient to pick a time.</p>
                <div className="flex gap-2">
                  <Link
                    href="/login"
                    className={cn(buttonVariants({ size: "sm" }), "bg-[#0E6B58] text-white hover:bg-[#0B5646]")}
                  >
                    Log in
                  </Link>
                  <Link href="/signup" className={buttonVariants({ size: "sm", variant: "outline" })}>
                    Sign up
                  </Link>
                </div>
              </div>
            ) : session.role !== "patient" ? (
              <p className="text-sm text-muted-foreground">Doctor accounts cannot book appointments.</p>
            ) : (
              <SlotPicker doctorId={doc.id} today={istNow().today} fee={doc.fee} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}