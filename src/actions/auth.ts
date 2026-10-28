"use server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { doctors, users } from "@/db/schema";
import { createSession, destroySession } from "@/lib/session";
import { loginSchema, signupSchema } from "@/lib/validators";

export type ActionState =
  | { error?: string; success?: boolean; fieldErrors?: Record<string, string[] | undefined> }
  | undefined;

export async function signup(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  const email = d.email.toLowerCase();

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) return { error: "An account with this email already exists" };

  const passwordHash = await bcrypt.hash(d.password, 10);
  const [user] = await db.insert(users).values({ name: d.name, email, passwordHash, role: d.role }).returning();

  if (d.role === "doctor") {
    await db.insert(doctors).values({
      userId: user.id,
      specialization: d.specialization!,
      experienceYears: d.experienceYears ?? 0,
      fee: d.fee ?? 0,
    });
  }

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect(user.role === "doctor" ? "/doctor" : "/patient");
}

export async function login(_: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  const [user] = await db.select().from(users).where(eq(users.email, parsed.data.email.toLowerCase()));
  const ok = user && (await bcrypt.compare(parsed.data.password, user.passwordHash));
  if (!ok) return { error: "Invalid email or password" };

  await createSession({ userId: user.id, role: user.role, name: user.name });
  redirect(user.role === "doctor" ? "/doctor" : "/patient");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}