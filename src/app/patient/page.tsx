import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cancelAppointment } from "@/actions/appointments";
import { CancelButton } from "@/components/cancel-button";
import { DateBlock } from "@/components/date-block";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { requireRole } from "@/lib/auth-guard";
import { prettyDate } from "@/lib/format";
import { rupees } from "@/lib/money";
import { getPaidAmounts, getPatientAppointments } from "@/lib/queries";
import { refundFor } from "@/lib/refund-policy";
import { istNow } from "@/lib/slots";
import { cn } from "@/lib/utils";

export default async function PatientDashboard() {
  const s = await requireRole("patient");
  const [all, paid] = await Promise.all([getPatientAppointments(s.userId), getPaidAmounts(s.userId)]);
  const { today } = istNow();

  const isUpcoming = (a: (typeof all)[number]) => a.status === "booked" && a.date >= today;
  const upcoming = all.filter(isUpcoming);
  const history = all.filter((a) => !isUpcoming(a)).reverse();
  const completed = all.filter((a) => a.status === "completed").length;
  const cancelled = all.filter((a) => a.status === "cancelled").length;

  const stats = [
    { label: "Upcoming", value: upcoming.length },
    { label: "Completed", value: completed },
    { label: "Cancelled", value: cancelled },
  ];

  function cancelMessage(a: (typeof all)[number]) {
    const amount = paid.get(a.id);
    if (!amount) return "Cancel this appointment?";
    const d = refundFor({ date: a.date, startTime: a.startTime, cancelledBy: "patient", amountPaise: amount });
    return d.amountPaise > 0
      ? `Cancel this appointment? You will get a refund of ${rupees(d.amountPaise)} (${d.percent}% of ${rupees(amount)}).`
      : `Cancel this appointment? No refund applies because it is less than 2 hours away.`;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Hi, {s.name}</h1>
          <p className="text-sm text-muted-foreground">Here is what is coming up.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/patient/payments" className={buttonVariants({ variant: "outline" })}>
            Payment history
          </Link>
          <Link
            href="/doctors"
            className={cn(buttonVariants(), "bg-[#0E6B58] text-white hover:bg-[#0B5646]")}
          >
            Book new appointment
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((st) => (
          <div key={st.label} className="rounded-xl border bg-card p-4">
            <p className="text-2xl font-semibold text-[#10231F]">{st.value}</p>
            <p className="text-xs text-muted-foreground">{st.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-[#10231F]">Upcoming</h2>

        {upcoming.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center">
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#EAF5F1] text-[#0E6B58]">
              <CalendarDays className="h-6 w-6" />
            </span>
            <p className="font-medium text-[#10231F]">No upcoming appointments</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Find a doctor and pick a time that works for you.
            </p>
            <Link
              href="/doctors"
              className={cn(buttonVariants({ size: "sm" }), "mt-4 bg-[#0E6B58] text-white hover:bg-[#0B5646]")}
            >
              Find a doctor
            </Link>
          </div>
        )}

        {upcoming.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-4">
            <DateBlock date={a.date} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-[#10231F]">{a.doctorName}</p>
              <p className="text-muted-foreground">{a.specialization}</p>
              <p className="mt-1">
                {prettyDate(a.date)}, {a.startTime} to {a.endTime}
              </p>
              {a.reason && <p className="text-muted-foreground">Reason: {a.reason}</p>}
              {paid.get(a.id) ? (
                <p className="mt-1 text-xs font-medium text-[#0E6B58]">Paid {rupees(paid.get(a.id)!)}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={a.status} />
              <Link
                href={`/patient/reschedule/${a.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Reschedule
              </Link>
              <form action={cancelAppointment.bind(null, a.id)}>
                <CancelButton message={cancelMessage(a)} />
              </form>
            </div>
          </div>
        ))}
      </section>

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-[#10231F]">History</h2>
          {history.map((a) => (
            <div key={a.id} className="flex items-center gap-4 rounded-xl border bg-card p-3 text-sm">
              <DateBlock date={a.date} />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-[#10231F]">{a.doctorName}</p>
                <p className="text-muted-foreground">
                  {a.specialization} · {prettyDate(a.date)}, {a.startTime} to {a.endTime}
                </p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}