import { cancelAppointment, completeAppointment } from "@/actions/appointments";
import { removeAvailability } from "@/actions/doctor";
import { AvailabilityForm } from "@/components/availability-form";
import { ProfileForm } from "@/components/profile-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/lib/auth-guard";
import { DAYS, prettyDate } from "@/lib/format";
import { getAvailability, getDoctorAppointments, getDoctorByUserId } from "@/lib/queries";
import { istNow } from "@/lib/slots";

export default async function DoctorDashboard() {
  const s = await requireRole("doctor");
  const doc = await getDoctorByUserId(s.userId);
  if (!doc) return <p>Doctor profile not found.</p>;

  const [appts, avail] = await Promise.all([getDoctorAppointments(s.userId), getAvailability(doc.id)]);
  const { today } = istNow();

  const isUpcoming = (a: (typeof appts)[number]) => a.status === "booked" && a.date >= today;
  const upcoming = appts.filter(isUpcoming);
  const past = appts.filter((a) => !isUpcoming(a)).reverse();
  const stats = [
    { label: "Upcoming", value: upcoming.length },
    { label: "Completed", value: appts.filter((a) => a.status === "completed").length },
    { label: "Cancelled", value: appts.filter((a) => a.status === "cancelled").length },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{s.name}</h1>
        <p className="text-sm text-muted-foreground">{doc.specialization} · Doctor dashboard</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((x) => (
          <Card key={x.label}>
            <CardContent className="py-4">
              <p className="text-2xl font-semibold">{x.value}</p>
              <p className="text-sm text-muted-foreground">{x.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-medium">Upcoming appointments</h2>
        {upcoming.length === 0 && <p className="text-sm text-muted-foreground">No upcoming appointments.</p>}
        {upcoming.map((a) => (
          <Card key={a.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
              <div className="text-sm">
                <p className="font-medium">{a.patientName}</p>
                <p className="text-muted-foreground">{a.patientEmail}</p>
                <p>{prettyDate(a.date)}, {a.startTime} to {a.endTime}</p>
                {a.reason && <p className="text-muted-foreground">Reason: {a.reason}</p>}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={a.status} />
                <form action={completeAppointment.bind(null, a.id)}>
                  <Button type="submit" size="sm">Mark complete</Button>
                </form>
                <form action={cancelAppointment.bind(null, a.id)}>
                  <Button type="submit" variant="destructive" size="sm">Cancel</Button>
                </form>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-medium">Past and cancelled</h2>
          {past.map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-center justify-between gap-3 py-4 text-sm">
                <div>
                  <p className="font-medium">{a.patientName}</p>
                  <p className="text-muted-foreground">{prettyDate(a.date)}, {a.startTime}</p>
                </div>
                <StatusBadge status={a.status} />
              </CardContent>
            </Card>
          ))}
        </section>
      )}

      <Card>
        <CardHeader><CardTitle>Availability</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {avail.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No working hours set. Patients cannot book until you add some.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {avail.map((a) => (
                <li key={a.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span>
                    <span className="font-medium">{DAYS[a.dayOfWeek]}</span>: {a.startTime} to {a.endTime},{" "}
                    {a.slotMinutes}-min slots
                  </span>
                  <form action={removeAvailability.bind(null, a.dayOfWeek)}>
                    <Button type="submit" variant="ghost" size="sm">Remove</Button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <AvailabilityForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
        <CardContent>
          <ProfileForm
            specialization={doc.specialization}
            experienceYears={doc.experienceYears}
            fee={doc.fee}
            bio={doc.bio}
            clinicAddress={doc.clinicAddress}
          />
        </CardContent>
      </Card>
    </div>
  );
}