import { sql } from "drizzle-orm";
import {
  pgTable, pgEnum, uuid, text, jsonb, integer, timestamp, date, uniqueIndex, index,
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
    //Which seat of the slot this booking holds (1 to capacity)
    seatNo: integer("seat_no").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    //A seat in a slot can only be held by one active appointment. This is the capcity lock.
    uniqueIndex("one_booking_per_seat")
      .on(t.doctorId, t.date, t.startTime, t.seatNo)
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

// ---- Notifications ----

export const notificationPreferences = pgTable("notification_preferences", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  phone: text("phone"),
  emailEnabled: boolean("email_enabled").default(true).notNull(), // appointment emails
  smsEnabled: boolean("sms_enabled").default(false).notNull(), // opt-in only
  smsConsentAt: timestamp("sms_consent_at", { withTimezone: true }),
  promoEmail: boolean("promo_email").default(false).notNull(), // optional, off by default
  promoSms: boolean("promo_sms").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Every message we try to send, per channel: type, recipient, status, attempts, provider reference
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    category: text("category").default("operational").notNull(), // operational | promotional
    channel: text("channel").notNull(), // in_app | email | sms
    recipient: text("recipient").notNull(),
    subject: text("subject"),
    body: text("body").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status").default("pending").notNull(), // pending | sending | sent | failed | dead | skipped
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    providerRef: text("provider_ref"),
    payload: text("payload"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    // The same event can never create the same message twice for the same person and channel
    uniqueIndex("notification_idem").on(t.idempotencyKey, t.channel, t.userId),
    index("notification_due").on(t.status, t.nextAttemptAt),
  ]
);

// Days a doctor is on leave (used in Phase 2)
export const doctorLeaves = pgTable(
  "doctor_leaves",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("doctor_leave_day").on(t.doctorId, t.date)]
);

// Wave and stream schedules. Exactly one of dayOfWeek (recurring weekly) or date (one-off) is set.
// A one-off date beats the weekly schedule, which beats the plain availability table.
export const schedules = pgTable(
  "schedules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    doctorId: uuid("doctor_id").notNull().references(() => doctors.id, { onDelete: "cascade" }),
    type: text("type").notNull(), // "wave" | "stream"
    dayOfWeek: integer("day_of_week"),
    date: date("date", { mode: "string" }),
    startTime: text("start_time").notNull(),
    endTime: text("end_time").notNull(),
    slotMinutes: integer("slot_minutes"), // wave only
    capacity: integer("capacity").default(1).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("schedules_weekly").on(t.doctorId, t.dayOfWeek).where(sql`${t.dayOfWeek} is not null`),
    uniqueIndex("schedules_one_date").on(t.doctorId, t.date).where(sql`${t.date} is not null`),
  ]
);

// Write actions proposed by the AI assistant. Nothing runs until the user confirms.
export const assistantActions = pgTable(
  "assistant_actions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    args: jsonb("args").notNull(),
    summary: text("summary").notNull(),
    status: text("status").default("pending").notNull(), // pending | confirmed | cancelled | expired | failed
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    result: text("result"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("assistant_actions_user").on(t.userId, t.status)]
);