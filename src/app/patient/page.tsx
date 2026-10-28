import Link from "next/link";
import { cancelAppointment } from "@/actions/appointments";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guard";
import { prettyDate } from "@/lib/format";
import { getPatientAppointments } from "@/lib/queries";
import { istNow } from "@/lib/slots";

export default async function PatientDashboard() {
  const s = await requireRole("patient");
  const all = await getPatientAppointments(s.userId);
  const { today } = istNow();

  const isUpcoming = (a: (typeof all)[number]) => a.status === "booked" && a.date >= today;
  const upcoming = all.filter(isUpcoming);
  const history = all.filter((a) => !isUpcoming(a)).reverse();

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hi, {s.name}</h1>
          <p className="text-sm text-muted-foreground">Your appointments</p>
        </div>
        <Link href="/doctors" className={buttonVariants()}>Book new</Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Upcoming</h2>
        {upcoming.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing scheduled. Find a doctor to book one.</p>
        )}
        {upcoming.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="text-sm">
                <p className="font-medium">{a.doctorName} · {a.specialization}</p>
                <p>{prettyDate(a.date)}, {a.startTime} to {a.endTime}</p>
                {a.reason && <p className="text-muted-foreground">Reason: {a.reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <Link href={`/patient/reschedule/${a.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Reschedule
                </Link>
                <form action={cancelAppointment.bind(null, a.id)}>
                  <Button type="submit" variant="destructive" size="sm">Cancel</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">History</h2>
          {history.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                <div>
                  <p className="font-medium">{a.doctorName} · {a.specialization}</p>
                  <p className="text-muted-foreground">{prettyDate(a.date)}, {a.startTime}</p>
                </div>
                <StatusBadge status={a.status} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </div>
  );
}