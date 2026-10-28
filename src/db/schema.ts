import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, integer, timestamp, date, uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["patient", "doctor"]);
export const statusEnum = pgEnum("appointment_status", ["booked", "cancelled", "completed"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const doctors = pgTable("doctors", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique()
    .references(() => users.id, { onDelete: "cascade" }),
  specialization: text("specialization").notNull(),
  experienceYears: integer("experience_years").default(0).notNull(),
  fee: integer("fee").default(0).notNull(),
  bio: text("bio"),
  clinicAddress: text("clinic_address"),
});

// One working window per weekday per doctor (0 = Sunday ... 6 = Saturday)
export const availability = pgTable(
  "availability",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    doctorId: uuid("doctor_id").notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    dayOfWeek: integer("day_of_week").notNull(),
    startTime: text("start_time").notNull(), // "HH:MM"
    endTime: text("end_time").notNull(),
    slotMinutes: integer("slot_minutes").default(30).notNull(),
  },
  (t) => [uniqueIndex("availability_doctor_day").on(t.doctorId, t.dayOfWeek)]
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    doctorId: uuid("doctor_id").notNull()
      .references(() => doctors.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(), // "YYYY-MM-DD"
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    status: statusEnum("status").default("booked").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Two active bookings can never share a doctor + date + slot
    uniqueIndex("one_booking_per_slot")
      .on(t.doctorId, t.date, t.startTime)
      .where(sql`${t.status} = 'booked'`),
  ]
);

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rescheduleHistory = pgTable("reschedule_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  appointmentId: uuid("appointment_id").notNull()
    .references(() => appointments.id, { onDelete: "cascade" }),
  oldDate: date("old_date", { mode: "string" }).notNull(),
  oldStartTime: text("old_start_time").notNull(),
  newDate: date("new_date", { mode: "string" }).notNull(),
  newStartTime: text("new_start_time").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});