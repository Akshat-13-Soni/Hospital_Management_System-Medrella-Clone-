"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/actions/auth";
import { FieldError } from "@/components/field-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Log in to manage your appointments.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
            <FieldError messages={state?.fieldErrors?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
            <FieldError messages={state?.fieldErrors?.password} />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Logging in..." : "Log in"}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            New here? <Link href="/signup" className="underline">Create an account</Link>
          </p>
          <p className="rounded-md bg-muted p-2 text-xs text-muted-foreground">
            Demo doctor: ananya@demo.com / password123
          </p>
        </form>
      </CardContent>
    </Card>
  );
}