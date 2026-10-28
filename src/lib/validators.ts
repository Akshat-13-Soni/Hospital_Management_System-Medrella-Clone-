import { z } from "zod";

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