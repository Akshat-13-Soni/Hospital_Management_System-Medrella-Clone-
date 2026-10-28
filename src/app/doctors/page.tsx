import Link from "next/link";
import { DoctorAvatar } from "@/components/doctor-avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listDoctors } from "@/lib/queries";
import { cn } from "@/lib/utils";

const SPECIALTIES = ["Cardiology", "Dermatology", "Pediatrics"];

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const doctors = await listDoctors(q);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Find a doctor</h1>
        <p className="text-sm text-muted-foreground">
          Browse specialists and book a time that suits you.
        </p>
      </div>

      <div className="space-y-3">
        <form className="flex max-w-xl gap-2">
          <Input name="q" defaultValue={q} placeholder="Search by name or specialty" aria-label="Search doctors" />
          <button
            type="submit"
            className={cn(buttonVariants(), "bg-[#0E6B58] text-white hover:bg-[#0B5646]")}
          >
            Search
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {SPECIALTIES.map((sp) => {
            const active = q?.toLowerCase() === sp.toLowerCase();
            return (
              <Link
                key={sp}
                href={active ? "/doctors" : `/doctors?q=${sp}`}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-[#0E6B58] bg-[#0E6B58] text-white"
                    : "hover:bg-[#EAF5F1] hover:text-[#0E6B58]"
                )}
              >
                {sp}
              </Link>
            );
          })}
        </div>
      </div>

      {doctors.length === 0 ? (
        <div className="rounded-2xl border border-dashed px-6 py-10 text-center">
          <p className="font-medium text-[#10231F]">No doctors found</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different name or specialty.</p>
          <Link href="/doctors" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-4")}>
            Clear search
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-4 rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <DoctorAvatar name={d.name} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#10231F]">{d.name}</p>
                  <Badge variant="secondary" className="mt-1 bg-[#EAF5F1] text-[#0E6B58]">
                    {d.specialization}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{d.experienceYears} years experience</span>
                <span className="font-semibold text-[#10231F]">₹{d.fee}</span>
              </div>
              <Link
                href={`/doctors/${d.id}`}
                className={cn(buttonVariants(), "w-full bg-[#0E6B58] text-white hover:bg-[#0B5646]")}
              >
                View and book
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}