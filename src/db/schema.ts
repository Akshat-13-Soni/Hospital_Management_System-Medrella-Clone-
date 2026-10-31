import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, integer, timestamp, date, uniqueIndex, index,
  boolean,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["patient", "doctor"]);
export const statusEnum = pgEnum("appointment_status", [
  "booked", "cancelled", "completed", "pending_payment",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "created", "pending", "paid", "failed", "abandoned", "refunded", "partially_refunded",
]);
export const refundStatusEnum = pgEnum("refund_status", ["pending", "processed", "failed"]);
export const reminderStatusEnum = pgEnum("reminder_status", ["pending", "sent", "cancelled", "failed"]);

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
    // Set while status = 'pending_payment': the slot is held until this time
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    // Two active appointments (booked or awaiting payment) can never share a slot
    uniqueIndex("one_booking_per_slot")
      .on(t.doctorId, t.date, t.startTime)
      .where(sql`${t.status} not in ('cancelled', 'completed')`),
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

// ---- Payments (amounts stored in paise: fee in rupees x 100) ----

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id").notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    provider: text("provider").default("razorpay").notNull(),
    providerOrderId: text("provider_order_id").notNull().unique(),
    providerPaymentId: text("provider_payment_id").unique(),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    status: paymentStatusEnum("status").default("created").notNull(),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    paidAt: timestamp("paid_at"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("payments_appointment_idx").on(t.appointmentId)]
);

export const refunds = pgTable(
  "refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    paymentId: uuid("payment_id").notNull()
      .references(() => payments.id, { onDelete: "cascade" }),
    amountPaise: integer("amount_paise").notNull(),
    reason: text("reason").notNull(),
    status: refundStatusEnum("status").default("pending").notNull(),
    providerRefundId: text("provider_refund_id").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    processedAt: timestamp("processed_at"),
  },
  (t) => [index("refunds_payment_idx").on(t.paymentId)]
);

// Gateway event ids we have already handled (makes webhooks idempotent)
export const webhookEvents = pgTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  provider: text("provider").default("razorpay").notNull(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    appointmentId: uuid("appointment_id").notNull()
      .references(() => appointments.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(), // "24h" | "1h"
    sendAt: timestamp("send_at", { withTimezone: true }).notNull(),
    status: reminderStatusEnum("status").default("pending").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("reminder_per_appointment_kind").on(t.appointmentId, t.kind),
    index("reminders_due_idx").on(t.status, t.sendAt),
  ]
);