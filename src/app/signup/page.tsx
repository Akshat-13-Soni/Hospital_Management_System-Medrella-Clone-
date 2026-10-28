"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signup } from "@/actions/auth";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const fe = state?.fieldErrors;

  const roles = [
    { value: "patient", label: "Patient", hint: "Book appointments" },
    { value: "doctor", label: "Doctor", hint: "Manage your schedule" },
  ] as const;

  return (
    <div className="mx-auto flex max-w-md flex-col py-6">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          It takes less than a minute.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <form action={action} className="space-y-4">
          <input type="hidden" name="role" value={role} />

          <div className="space-y-2">
            <Label>I am a</Label>
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  aria-pressed={role === r.value}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B58] focus-visible:ring-offset-2",
                    role === r.value
                      ? "border-[#0E6B58] bg-[#EAF5F1]"
                      : "hover:bg-muted"
                  )}
                >
                  <span className="block text-sm font-medium text-[#10231F]">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" autoComplete="name" required />
            <FieldError messages={fe?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            <FieldError messages={fe?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
            <FieldError messages={fe?.password} />
          </div>

          {role === "doctor" && (
            <div className="space-y-4 rounded-xl bg-[#EAF5F1]/60 p-4">
              <div className="space-y-2">
                <Label htmlFor="specialization">Specialization</Label>
                <Input id="specialization" name="specialization" placeholder="e.g. Cardiology" required />
                <FieldError messages={fe?.specialization} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="experienceYears">Experience (years)</Label>
                  <Input id="experienceYears" name="experienceYears" type="number" min={0} defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fee">Fee (₹)</Label>
                  <Input id="fee" name="fee" type="number" min={0} defaultValue={500} />
                </div>
              </div>
            </div>
          )}

          {state?.error && (
            <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full bg-[#0E6B58] text-white hover:bg-[#0B5646]"
            disabled={pending}
          >
            {pending ? "Creating account..." : "Sign up"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-[#0E6B58] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}