import { summarize, type QueueRow } from "@/lib/queue-rank";

type Entry = QueueRow & { patientName: string };

const LABEL: Record<string, string> = {
  waiting: "Waiting", in_consultation: "In consultation", completed: "Done",
  no_show: "No-show", cancelled: "Cancelled",
};

export function QueueCard({ entries }: { entries: Entry[] }) {
  const { current, next } = summarize(entries);
  const tiles = [
    { label: "Current token", e: current },
    { label: "Next token", e: next },
  ];
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-6">
      <h2 className="font-semibold text-[#10231F]">Today&apos;s queue</h2>
      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ label, e }) => (
          <div key={label} className="rounded-xl border bg-muted/40 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold text-[#0E6B58]">{e ? e.tokenNo : "-"}</p>
            <p className="text-sm text-muted-foreground">{e ? e.patientName : "None"}</p>
          </div>
        ))}
      </div>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No patients have checked in yet.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted font-semibold">{e.tokenNo}</span>
              <span className="min-w-0 flex-1 font-medium">{e.patientName}</span>
              <span className="text-muted-foreground">{LABEL[e.status] ?? e.status}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}