import { z } from "zod";
import { toMin } from "./slots";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const signupSchema = z
  .object({
    name: z.string().trim().min(2, "Name is too short"),
    email: z.string().trim().email("Invalid email"),
    password: z.string().min(8, "Minimum 8 characters"),
    role: z.enum(["patient", "doctor"]),
    specialization: z.string().trim().optional(),
    experienceYears: z.coerce.number().int().min(0).optional(),
    fee: z.coerce.number().int().min(0).optional(),
  })
  .refine((d) => d.role !== "doctor" || !!d.specialization, {
    message: "Specialization is required for doctors",
    path: ["specialization"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const profileSchema = z.object({
  specialization: z.string().trim().min(2),
  experienceYears: z.coerce.number().int().min(0),
  fee: z.coerce.number().int().min(0),
  bio: z.string().trim().max(1000).optional(),
  clinicAddress: z.string().trim().max(300).optional(),
});

export const availabilitySchema = z
  .object({
    dayOfWeek: z.coerce.number().int().min(0).max(6),
    startTime: hhmm,
    endTime: hhmm,
    slotMinutes: z.coerce.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v), "Invalid slot length"),
  })
  .refine((d) => d.startTime < d.endTime, { message: "End must be after start", path: ["endTime"] });

export const bookSchema = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: hhmm,
  reason: z.string().trim().max(500).optional(),
});

export const rescheduleSchema = z.object({
  appointmentId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: hhmm,
});

export const scheduleSchema = z
  .object({
    type: z.enum(["wave", "stream"]),
    recurrence: z.enum(["weekly", "date"]),
    dayOfWeek: z.coerce.number().int().min(0).max(6).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date").optional(),
    startTime: hhmm,
    endTime: hhmm,
    slotMinutes: z.coerce.number().int().refine((v) => [15, 20, 30, 45, 60].includes(v), "Invalid slot length").optional(),
    capacity: z.coerce.number().int().min(1, "At least 1").max(50, "At most 50"),
  })
  .refine((d) => d.startTime < d.endTime, { message: "End must be after start", path: ["endTime"] })
  .refine((d) => d.recurrence !== "weekly" || d.dayOfWeek !== undefined, { message: "Choose a day", path: ["dayOfWeek"] })
  .refine((d) => d.recurrence !== "date" || !!d.date, { message: "Pick a date", path: ["date"] })
  .refine(
    (d) => d.type !== "wave" || (d.slotMinutes !== undefined && toMin(d.endTime) - toMin(d.startTime) >= d.slotMinutes),
    { message: "The window must fit at least one slot", path: ["slotMinutes"] }
  );