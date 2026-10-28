import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listDoctors } from "@/lib/queries";

export default async function DoctorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const doctors = await listDoctors(q);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Find a doctor</h1>
        <form className="flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Name or specialization" />
          <button className={buttonVariants({ size: "sm" })} type="submit">Search</button>
        </form>
      </div>

      {doctors.length === 0 ? (
        <p className="text-muted-foreground">No doctors found.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {doctors.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  {d.name}
                  <Badge variant="secondary">{d.specialization}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p>{d.experienceYears} years experience · ₹{d.fee} per visit</p>
                <Link href={`/doctors/${d.id}`} className={buttonVariants({ size: "sm" })}>
                  View and book
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}