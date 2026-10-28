"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { availability, doctors } from "@/db/schema";
import { getSession } from "@/lib/session";
import { availabilitySchema, profileSchema } from "@/lib/validators";
import type { ActionState } from "./auth";

async function requireDoctor() {
  const s = await getSession();
  if (!s || s.role !== "doctor") throw new Error("Unauthorized");
  const [doc] = await db.select().from(doctors).where(eq(doctors.userId, s.userId));
  if (!doc) throw new Error("Doctor profile not found");
  return doc;
}

export async function updateProfile(_: ActionState, formData: FormData): Promise<ActionState> {
  const doc = await requireDoctor();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  await db.update(doctors).set(parsed.data).where(eq(doctors.id, doc.id));
  revalidatePath("/doctor");
  return {success: true};
}

export async function saveAvailability(_: ActionState, formData: FormData): Promise<ActionState> {
  const doc = await requireDoctor();
  const parsed = availabilitySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };

  await db
    .insert(availability)
    .values({ doctorId: doc.id, ...parsed.data })
    .onConflictDoUpdate({
      target: [availability.doctorId, availability.dayOfWeek],
      set: {
        startTime: parsed.data.startTime,
        endTime: parsed.data.endTime,
        slotMinutes: parsed.data.slotMinutes,
      },
    });
  revalidatePath("/doctor");
  return { success : true};
}

export async function removeAvailability(dayOfWeek: number) {
  const doc = await requireDoctor();
  await db.delete(availability).where(and(eq(availability.doctorId, doc.id), eq(availability.dayOfWeek, dayOfWeek)));
  revalidatePath("/doctor");
}