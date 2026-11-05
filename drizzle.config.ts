import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
  tablesFilter: [
    "users", "doctors", "availability", "appointments", "notifications",
    "reschedule_history", "payments", "refunds", "webhook_events", "reminders",
    "notification_preferences", "notification_log", "doctor_leaves",
  ],
});