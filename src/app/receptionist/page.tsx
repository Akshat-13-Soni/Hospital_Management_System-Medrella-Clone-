import { checkIn, completePatient, noShow } from "@/actions/queue";
import { AutoRefresh } from "@/components/auto-refresh";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/lib/auth-guard";
import { prettyDate } from "@/lib/format";
import { getClinicDay } from "@/lib/queue";
import { istNow } from "@/lib/slots";

export default async function ReceptionistDashboard() {
  await requireRole("receptionist");
  const { today } = istNow();
  const rows = await getClinicDay(today);

  const doctors = new Map<string, { name: string; rows: typeof rows }>();
  for (const r of rows) {
    const g = doctors.get(r.doctorId) ?? { name: r.doctorName, rows: [] };
    g.rows.push(r);
    doctors.set(r.doctorId, g);
  }

  return (
    <div className="space-y-6">
      <AutoRefresh />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Reception</h1>
        <p className="text-sm text-muted-foreground">Today, {prettyDate(today)}</p>
      </div>

      {doctors.size === 0 && (
        <div className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
          No appointments today.
        </div>
      )}

      {[...doctors.entries()].map(([id, g]) => (
        <section key={id} className="space-y-3 rounded-2xl border bg-card p-6">
          <h2 className="font-semibold text-[#10231F]">{g.name}</h2>
          <ul className="space-y-2 text-sm">
            {g.rows.map((r) => {
              const done = r.apptStatus === "completed" || r.queueStatus === "completed";
              return (
                <li key={r.appointmentId} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
                  <span className="w-24 text-muted-foreground">{r.startTime} to {r.endTime}</span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.patientName}</span>
                    {r.tokenNo ? <span className="text-muted-foreground"> · Token {r.tokenNo}</span> : null}
                    {r.queueStatus === "in_consultation" && <span className="font-medium text-[#0E6B58]"> · Being seen</span>}
                    {r.queueStatus === "waiting" && <span className="text-muted-foreground"> · Waiting</span>}
                  </span>
                  <div className="flex gap-2">
                    {done ? (
                      <span className="text-muted-foreground">Done</span>
                    ) : r.apptStatus === "no_show" || r.queueStatus === "no_show" ? (
                      <span className="text-muted-foreground">No-show</span>
                    ) : (
                      <>
                        {!r.queueStatus && (
                          <form action={checkIn.bind(null, r.appointmentId)}>
                            <Button type="submit" size="sm" className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">Check in</Button>
                          </form>
                        )}
                        {r.queueStatus === "in_consultation" && (
                          <form action={completePatient.bind(null, r.appointmentId)}>
                            <Button type="submit" size="sm" className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">Complete</Button>
                          </form>
                        )}
                        <form action={noShow.bind(null, r.appointmentId)}>
                          <Button type="submit" size="sm" variant="outline">No-show</Button>
                        </form>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}