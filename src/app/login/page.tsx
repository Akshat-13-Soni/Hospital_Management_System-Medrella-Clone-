"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <div className="mx-auto flex max-w-md flex-col py-6">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#0E6B58] text-lg font-bold text-white">
          M
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-[#10231F]">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Log in to manage your appointments.
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
            <FieldError messages={state?.fieldErrors?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            <FieldError messages={state?.fieldErrors?.password} />
          </div>

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
            {pending ? "Logging in..." : "Log in"}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          New here?{" "}
          <Link href="/signup" className="font-medium text-[#0E6B58] hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      <div className="mt-4 rounded-xl bg-[#EAF5F1] px-4 py-3 text-xs text-[#10231F]">
        <p className="font-medium">Try the demo</p>
        <p className="mt-0.5 text-[#10231F]/70">Doctor: ananya@demo.com / password123</p>
      </div>
    </div>
  );
}