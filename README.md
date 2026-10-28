# Medrella Appointment Booking App

A full-stack appointment booking application with patient and doctor roles, built for the internship task using the Medrella demo as the starting point.

**Live app:** https://hospital-management-system-nine-henna.vercel.app
**Repository:** https://github.com/Akshat-13-Soni/Hospital_Management_System-Medrella-Clone-

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Doctor (Cardiology) | ananya@demo.com | password123 |
| Doctor (Dermatology) | rahul@demo.com | password123 |
| Doctor (Pediatrics) | priya@demo.com | password123 |
| Patient | Sign up through the UI | |

Each seeded doctor works Monday to Friday, 09:00 to 17:00, in 30-minute slots.

## Features

**Authentication and sessions**
- Email and password signup and login with a role (patient or doctor)
- Passwords hashed with bcrypt
- JWT stored in an httpOnly cookie (7-day expiry)
- Role-based route guards (a patient cannot open the doctor dashboard and vice versa)

**Patient**
- Browse and search doctors by name or specialization
- View doctor profile, fee and working hours
- Book an appointment from live, available slots
- View upcoming and past appointments
- Reschedule (with reschedule history) and cancel
- In-app notifications, such as "Your appointment with Dr. XYZ on DD/MM/YYYY at HH:MM is confirmed."

**Doctor**
- Dashboard with upcoming, completed and cancelled counts
- See every booking with patient name, email, time and reason
- Mark appointments complete or cancel them (the patient is notified)
- Manage weekly availability (working hours and slot length per weekday)
- Edit profile (specialization, experience, fee, bio, clinic address)
- Notified when a patient books, reschedules or cancels

**Reliability**
- Slots are generated on the fly from availability, minus booked and past slots (IST)
- Double booking is prevented at the database level with a partial unique index on `(doctor_id, date, start_time)` where `status = 'booked'`, plus server-side re-validation

## Tech stack

- Next.js (App Router) and TypeScript, with Server Actions as the backend
- Tailwind CSS and shadcn/ui
- PostgreSQL on Neon, accessed with Drizzle ORM
- Zod for validation
- bcryptjs and jose for authentication
- Deployed on Vercel

## Project structure

```
src/
  actions/      Server Actions (auth, doctor, appointments, notifications, slots)
  app/          Routes: /, /login, /signup, /doctors, /doctors/[id],
                /patient, /patient/reschedule/[id], /doctor, /notifications
  components/   Navbar, slot picker, forms, shadcn/ui components
  db/           Drizzle schema and client
  lib/          Session, auth guards, queries, slot helpers, validators
scripts/
  seed.ts       Seeds demo doctors and availability
```

## Database schema

`users`, `doctors`, `availability`, `appointments`, `notifications`, `reschedule_history`.
Roles and appointment status are Postgres enums.

## Run locally

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` in the project root:
   ```
   DATABASE_URL=postgresql://<user>:<password>@<host>/<db>?sslmode=require
   JWT_SECRET=<a long random string>
   ```
3. Create the tables and seed demo data:
   ```bash
   npx drizzle-kit push
   npx tsx --env-file=.env.local scripts/seed.ts
   ```
4. Start the dev server:
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Deployment

Deployed on Vercel. Set `DATABASE_URL` and `JWT_SECRET` as environment variables in the Vercel project settings, then redeploy.

## Future scope

- Google OAuth and OTP or email verification
- Doctor credential verification and approval
- Ratings and reviews
- Elastic scheduling (multiple appointments per slot, expandable hours)
- Slot-utilisation analytics for doctors
- Email and SMS alerts and scheduled reminders