"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { signup } from "@/actions/auth";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { selectCls } from "@/lib/format";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  const [role, setRole] = useState<"patient" | "doctor">("patient");
  const fe = state?.fieldErrors;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>Sign up as a patient or as a doctor.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">I am a</Label>
            <select
              id="role" name="role" className={selectCls}
              value={role} onChange={(e) => setRole(e.target.value as "patient" | "doctor")}
            >
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" required />
            <FieldError messages={fe?.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            <FieldError messages={fe?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" minLength={8} required />
            <FieldError messages={fe?.password} />
          </div>

          {role === "doctor" && (
            <>
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
            </>
          )}

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating account..." : "Sign up"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Already registered? <Link href="/login" className="underline">Log in</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}