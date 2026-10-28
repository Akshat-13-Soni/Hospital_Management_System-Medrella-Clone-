import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/session";

export default async function Home() {
  const s = await getSession();
  if (s) redirect(s.role === "doctor" ? "/doctor" : "/patient");

  return (
    <section className="mx-auto max-w-2xl py-16 text-center">
      <h1 className="text-4xl font-bold tracking-tight">Book a doctor in under a minute</h1>
      <p className="mt-4 text-muted-foreground">
        Browse specialists, pick a free slot, and get instant confirmation. Doctors manage their
        availability and see every booking in one dashboard.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/doctors" className={buttonVariants({ size: "lg" })}>Find a doctor</Link>
        <Link href="/signup" className={buttonVariants({ size: "lg", variant: "outline" })}>
          Create account
        </Link>
      </div>
    </section>
  );
}