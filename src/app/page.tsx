import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

const specialties = ["Cardiology", "Dermatology", "Pediatrics"];

const steps = [
  { title: "Find a doctor", body: "Search by name or specialty and compare experience and visit fees." },
  { title: "Pick a free slot", body: "Only open times are shown, so every slot you see can be booked." },
  { title: "Get confirmation", body: "You and the doctor are notified instantly, and you can reschedule any time." },
];

const demoSlots = [
  { time: "10:00", state: "open" },
  { time: "10:30", state: "open" },
  { time: "11:00", state: "taken" },
  { time: "11:30", state: "picked" },
  { time: "12:00", state: "open" },
  { time: "12:30", state: "open" },
] as const;

const primary =
  "inline-flex h-12 items-center justify-center rounded-lg bg-[#0E6B58] px-6 text-base font-medium text-white transition-colors hover:bg-[#0B5546] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E6B58]";
const secondary =
  "inline-flex h-12 items-center justify-center rounded-lg border border-[#0E6B58]/30 bg-white px-6 text-base font-medium text-[#0E6B58] transition-colors hover:bg-[#EAF5F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E6B58]";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.role === "doctor" ? "/doctor" : "/patient");

  return (
    <div className="space-y-20 pb-8">
      {/* Hero: the product itself is the first thing people see */}
      <section className="grid items-center gap-10 pt-6 lg:grid-cols-[1.1fr_0.9fr] lg:pt-12">
        <div className="space-y-6">
          <h1 className="max-w-xl text-4xl font-semibold leading-[1.1] tracking-tight text-[#10231F] sm:text-5xl">
            See a doctor this week, not next month.
          </h1>
          <p className="max-w-lg text-lg leading-relaxed text-slate-600">
            Browse specialists, pick a time that is actually free, and get confirmed in under a minute. Doctors manage
            their hours and see every booking in one place.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/doctors" className={primary}>Find a doctor</Link>
            <Link href="/signup" className={secondary}>Create a free account</Link>
          </div>
          <p className="text-sm text-slate-500">
            Already booked?{" "}
            <Link href="/login" className="font-medium text-[#0E6B58] underline underline-offset-4">Log in</Link>
          </p>
        </div>

        {/* Product preview: a real-looking booking card */}
        <div className="rounded-2xl border border-[#0E6B58]/15 bg-[#EAF5F1] p-4 sm:p-6" aria-hidden="true">
          <div className="space-y-5 rounded-xl bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#0E6B58] text-lg font-semibold text-white">
                PN
              </div>
              <div>
                <p className="font-semibold text-[#10231F]">Dr. Priya Nair</p>
                <p className="text-sm text-slate-500">Pediatrics, 10 years experience</p>
              </div>
              <p className="ml-auto text-sm font-medium text-[#10231F]">₹500</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">Wednesday, 28 October</p>
              <div className="grid grid-cols-3 gap-2">
                {demoSlots.map((s) => (
                  <div
                    key={s.time}
                    className={
                      "rounded-md border py-2 text-center text-sm " +
                      (s.state === "picked"
                        ? "border-[#0E6B58] bg-[#0E6B58] font-medium text-white"
                        : s.state === "taken"
                          ? "border-slate-200 bg-slate-50 text-slate-400 line-through"
                          : "border-slate-200 text-slate-700")
                    }
                  >
                    {s.time}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md bg-[#10231F] py-2.5 text-center text-sm font-medium text-white">
              Confirm 11:30 appointment
            </div>
          </div>
        </div>
      </section>

      {/* Specialties */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-[#10231F]">Browse by specialty</h2>
        <div className="flex flex-wrap gap-3">
          {specialties.map((s) => (
            <Link
              key={s}
              href={`/doctors?q=${s}`}
              className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:border-[#0E6B58] hover:text-[#0E6B58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0E6B58]"
            >
              {s}
            </Link>
          ))}
          <Link
            href="/doctors"
            className="rounded-full px-5 py-2.5 text-sm font-medium text-[#0E6B58] underline underline-offset-4"
          >
            All doctors
          </Link>
        </div>
      </section>

      {/* How it works: a real sequence, so numbered */}
      <section className="space-y-6">
        <h2 className="text-2xl font-semibold tracking-tight text-[#10231F]">Booking takes three steps</h2>
        <ol className="grid gap-4 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 rounded-xl border border-slate-200 bg-white p-5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EAF5F1] text-sm font-semibold text-[#0E6B58]">
                {i + 1}
              </span>
              <div className="space-y-1">
                <h3 className="font-semibold text-[#10231F]">{s.title}</h3>
                <p className="text-sm leading-relaxed text-slate-600">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* For doctors */}
      <section className="flex flex-col gap-6 rounded-2xl bg-[#10231F] p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
        <div className="max-w-xl space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">Run your clinic day from one dashboard</h2>
          <p className="leading-relaxed text-white/75">
            Set your weekly hours, see who is coming and when, and get notified the moment a patient books,
            reschedules or cancels.
          </p>
        </div>
        <Link
          href="/signup"
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-lg bg-white px-6 text-base font-medium text-[#10231F] transition-colors hover:bg-[#EAF5F1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Create a doctor account
        </Link>
      </section>
    </div>
  );
}
