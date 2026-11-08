"use server";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { availability, doctors, schedules } from "@/db/schema";
import { getSession } from "@/lib/session";
import { istNow } from "@/lib/slots";
import { availabilitySchema, profileSchema, scheduleSchema } from "@/lib/validators";
import type { ActionState } from "./auth";
import { addLeaveDay, removeLeaveDay } from "@/lib/leave";

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

export async function addLeave(formData: FormData){
  const doc = await requireDoctor();
  await addLeaveDay(doc.id, String(formData.get("date") ?? ""));
  revalidatePath("/doctor");
  revalidatePath("/patient");
}

export async function removeLeave(date: string){
  const doc = await requireDoctor();
  await removeLeaveDay(doc.id, date);
  revalidatePath("/doctor");
}

export async function saveSchedule(_: ActionState, formData: FormData): Promise<ActionState> {
  const doc = await requireDoctor();
  const raw = Object.fromEntries(formData);
  // Only the fields that belong to the chosen type and recurrence are validated
  const parsed = scheduleSchema.safeParse({
    ...raw,
    dayOfWeek: raw.recurrence === "weekly" ? raw.dayOfWeek : undefined,
    date: raw.recurrence === "date" ? raw.date : undefined,
    slotMinutes: raw.type === "wave" ? raw.slotMinutes : undefined,
  });
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors };
  const d = parsed.data;
  if (d.recurrence === "date" && d.date! < istNow().today) {
    return { fieldErrors: { date: ["Choose today or a future date"] } };
  }

  const values = {
    doctorId: doc.id,
    type: d.type,
    dayOfWeek: d.recurrence === "weekly" ? d.dayOfWeek! : null,
    date: d.recurrence === "date" ? d.date! : null,
    startTime: d.startTime,
    endTime: d.endTime,
    slotMinutes: d.type === "wave" ? d.slotMinutes! : null,
    capacity: d.capacity,
  };
  const set = { type: values.type, startTime: values.startTime, endTime: values.endTime, slotMinutes: values.slotMinutes, capacity: values.capacity };

  if (d.recurrence === "weekly") {
    await db.insert(schedules).values(values).onConflictDoUpdate({
      target: [schedules.doctorId, schedules.dayOfWeek],
      targetWhere: sql`${schedules.dayOfWeek} is not null`,
      set,
    });
  } else {
    await db.insert(schedules).values(values).onConflictDoUpdate({
      target: [schedules.doctorId, schedules.date],
      targetWhere: sql`${schedules.date} is not null`,
      set,
    });
  }
  revalidatePath("/doctor");
  revalidatePath(`/doctors/${doc.id}`);
  return { success: true };
}

export async function removeSchedule(id: string) {
  const doc = await requireDoctor();
  await db.delete(schedules).where(and(eq(schedules.id, id), eq(schedules.doctorId, doc.id)));
  revalidatePath("/doctor");
  revalidatePath(`/doctors/${doc.id}`);
}