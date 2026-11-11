import { cancelAppointment, completeAppointment } from "@/actions/appointments";
import { addLeave, removeAvailability, removeLeave, removeSchedule } from "@/actions/doctor";
import { AvailabilityForm } from "@/components/availability-form";
import { DateBlock } from "@/components/date-block";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { ProfileForm } from "@/components/profile-form";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth-guard";
import { DAYS, prettyDate } from "@/lib/format";
import { getAvailability, getDoctorAppointments, getDoctorByUserId, getSchedules } from "@/lib/queries";
import { ScheduleForm } from "@/components/schedule-form";
import { listLeaveDays } from "@/lib/leave";
import { istNow } from "@/lib/slots";
import { CancelButton } from "@/components/cancel-button";

export default async function DoctorDashboard() {
  const s = await requireRole("doctor");
  const doc = await getDoctorByUserId(s.userId);
  if (!doc) return <p>Doctor profile not found.</p>;

    const [appts, avail, leaveDays, scheds] = await Promise.all([
    getDoctorAppointments(s.userId),
    getAvailability(doc.id),
    listLeaveDays(doc.id),
    getSchedules(doc.id),
  ]);

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
      <div className="flex items-center gap-4">
        <DoctorAvatar name={s.name} className="h-14 w-14 text-lg" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">{s.name}</h1>
          <p className="text-sm text-muted-foreground">{doc.specialization} · Doctor dashboard</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((x) => (
          <div key={x.label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold text-[#10231F]">{x.value}</p>
            <p className="text-xs text-muted-foreground">{x.label}</p>
          </div>
        ))}
      </div>

      {avail.length === 0 && (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have no working hours set, so patients cannot book yet. Add them in the availability section below.
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold text-[#10231F]">Upcoming appointments</h2>
        {upcoming.length === 0 && (
          <div className="rounded-2xl border border-dashed px-6 py-8 text-center">
            <p className="font-medium text-[#10231F]">No upcoming appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              New bookings from patients will show up here.
            </p>
          </div>
        )}
        {upcoming.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
            <DateBlock date={a.date} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-[#10231F]">{a.patientName}</p>
              <p className="text-muted-foreground">{a.patientEmail}</p>
              <p className="mt-1">{prettyDate(a.date)}, {a.startTime} to {a.endTime}</p>
              {a.reason && <p className="text-muted-foreground">Reason: {a.reason}</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              <form action={completeAppointment.bind(null, a.id)}>
                <Button type="submit" size="sm" className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">
                  Mark complete
                </Button>
              </form>
              <form action={cancelAppointment.bind(null, a.id)}>
                <CancelButton message="Cancel this appointment? If the patient has paid, they will be refunded in full." />
              </form>
            </div>
          </div>
        ))}
      </section>

      {past.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-[#10231F]">Past and cancelled</h2>
          {past.map((a) => (
            <div key={a.id} className="flex items-center gap-4 rounded-xl border bg-card p-3 text-sm">
              <DateBlock date={a.date} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#10231F]">{a.patientName}</p>
                <p className="text-muted-foreground">{prettyDate(a.date)}, {a.startTime} to {a.endTime}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold text-[#10231F]">Availability</h2>
        {avail.length === 0 ? (
          <p className="text-sm text-muted-foreground">No working hours set yet.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {avail.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
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
      </section>
            <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold text-[#10231F]">Wave and stream schedules</h2>
        <p className="text-sm text-muted-foreground">
          A one-off date overrides the weekly schedule, and a weekly schedule overrides the working hours above.
          Wave splits the window into slots that each take several patients. Stream is one window with a total capacity.
        </p>
        {scheds.length > 0 && (
          <ul className="space-y-2 text-sm">
            {scheds.map((x) => (
              <li key={x.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>
                  <span className="font-medium capitalize">{x.type}</span>:{" "}
                  {x.date ? prettyDate(x.date) : `Every ${DAYS[x.dayOfWeek ?? 0]}`}, {x.startTime} to {x.endTime}
                  {x.type === "wave" ? `, ${x.slotMinutes}-min slots, ${x.capacity} per slot` : `, ${x.capacity} patients total`}
                </span>
                <form action={removeSchedule.bind(null, x.id)}>
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ScheduleForm />
      </section>
      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold text-[#10231F]">Days off</h2>
        <p className="text-sm text-muted-foreground">
          Marking a day off cancels every booked appointment on that day. Paid patients are refunded in full and
          notified.
        </p>
        {leaveDays.length > 0 && (
          <ul className="space-y-2 text-sm">
            {leaveDays.map((d) => (
              <li key={d} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="font-medium">{prettyDate(d)}</span>
                <form action={removeLeave.bind(null, d)}>
                  <Button type="submit" variant="ghost" size="sm">Remove</Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addLeave} className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            name="date"
            min={today}
            required
            className="rounded-md border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">Mark day off</Button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-6">
        <h2 className="font-semibold text-[#10231F]">Profile</h2>
        <ProfileForm
          specialization={doc.specialization}
          experienceYears={doc.experienceYears}
          fee={doc.fee}
          bio={doc.bio}
          clinicAddress={doc.clinicAddress}
        />
      </section>
    </div>
  );
}