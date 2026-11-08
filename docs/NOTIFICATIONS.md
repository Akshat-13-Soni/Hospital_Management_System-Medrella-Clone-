# Notifications, reminders and refunds

How Medrella sends email and SMS, schedules reminders, retries failures, and how to operate it.

## 1. Overview

Business code never sends a message directly. It raises a typed event (for example `onBookingConfirmed`, `onCancelled`, `onDoctorLeave`, `onReminder`). The event calls `emit`, which:

1. Renders the message from a template (`src/lib/notification-templates.ts`).
2. Always stores an in-app notification, once per event.
3. Loads the person's preferences and decides, per channel, whether to send or skip (`planChannels`).
4. Writes one row per message and channel to `notification_log` (the outbox). A unique key on `(idempotency_key, channel, user_id)` means the same event can never create the same message twice.
5. Delivers after the response is sent, so a slow provider never slows the user. A provider failure never breaks a booking.

Files: `src/lib/events.ts`, `notifier.ts`, `channels.ts`, `notification-templates.ts`, `preferences.ts`, `email.ts`, `sms.ts`, `reminders.ts`.

Notification messages never include the reason for the visit or any medical detail.

## 2. Events that send notifications

Booking confirmed, payment confirmed, new booking (doctor), reschedule (patient and doctor), cancellation (by patient or doctor), cancellation notice to the doctor, doctor leave, refund processed, refund failed, late-payment refund, appointment reminder.

## 3. Email setup (Gmail via Nodemailer)

1. On the Google account, turn on 2-Step Verification.
2. Create an App Password (Google Account, Security, App passwords).
3. Set `EMAIL_USER` to the full Gmail address and `EMAIL_APP_PASSWORD` to the 16-character password with no spaces.
4. Restart the app after changing environment variables. On Vercel, redeploy, because new variables only apply to new deployments.

Notes:

- Addresses ending in `@demo.com` or `@example.com`, or `.test`, are deliberately skipped (logged as `skipped`, reason `undeliverable_address`), so demo accounts do not bounce.
- Mail sent from a personal Gmail account can land in Spam. A verified domain with SPF and DKIM, through a provider such as Resend or Amazon SES, is the proper fix.

## 4. SMS setup

Choose a provider with `SMS_PROVIDER`.

| Value | Behaviour |
|---|---|
| `console` | Simulated. The message is printed in the server log and recorded as `sent`. It does not reach a phone. |
| `twilio` | Needs `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM`. `TWILIO_FROM` must be a number issued by Twilio, not the recipient's own number. Trial accounts can only text verified numbers, and sending to India may be restricted. |
| `msg91` | Implemented but untested. Needs DLT-registered templates and a sender ID before live use. |

Tips:

- The variable name is `SMS_PROVIDER` with a single underscore.
- SMS needs the person's consent and a saved phone number (see section 8).
- WhatsApp is not implemented. To add it: add a name in `channels.ts`, a sender file like `sms.ts`, and one entry in the `channels` map.

## 5. Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Neon Postgres connection |
| `EMAIL_USER`, `EMAIL_APP_PASSWORD` | Gmail sender |
| `SMS_PROVIDER` | `console`, `twilio` or `msg91` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Twilio, when used |
| `CRON_SECRET` | Bearer secret for the cron endpoint |
| `REMINDER_HOURS` | Reminder intervals before the appointment, default `24,1` |
| `APP_URL` | Base URL used for links in messages (optional) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Payments (test mode) |

Never commit `.env.local`. Never paste secrets into chat or screenshots. Rotate `CRON_SECRET` if it is ever exposed.

## 6. Reminders and scheduling

- When an appointment becomes `booked`, reminder rows are created in `reminders`, one per interval in `REMINDER_HOURS`. Intervals that have already passed are skipped.
- On reschedule, old reminders are cancelled and new ones created from the new time.
- On cancel or complete, pending reminders are marked `cancelled`.
- Times use IST (`+05:30`).

The cron endpoint is `GET /api/cron/reminders` with the header `Authorization: Bearer <CRON_SECRET>`. Each run:

1. Releases expired payment holds.
2. Sends due reminders. Before sending, it claims the reminder with a conditional update (so overlapping runs cannot send it twice) and re-checks that the appointment is still `booked` and in the future.
3. Retries failed notifications that are due.

It returns `{ ok, releasedHolds, sent, skipped, failed, retried }`.

Scheduling on the Vercel Hobby plan:

- `vercel.json` defines a daily cron (`0 4 * * *`), the Hobby limit.
- For timely reminders, an external pinger (for example cron-job.org) calls the endpoint every 5 minutes with the Authorization header.

## 7. Reliability

- **Tracking.** Every message is a row in `notification_log` with type, category, channel, recipient, subject, body, status, attempts, last error, provider reference and timestamps.
- **No duplicates.** The unique key described in section 1, plus a conditional claim (`status` to `sending`) before each delivery attempt.
- **Retries with backoff.** After a failure the row is `failed` with `next_attempt_at` set 1, 5, 15, 60 and then 240 minutes ahead. After 5 attempts it becomes `dead`. A row stuck in `sending` for 10 minutes is returned to `failed` by the next cron run.
- **Isolation.** A provider failure is caught, logged and retried. It never throws into the booking, payment or cancellation flow.

Status values: `pending`, `sending`, `sent`, `failed`, `dead`, `skipped`.

## 8. Preferences and consent

Settings page: `/settings/notifications`.

- In-app notifications are always on.
- Email: on by default, can be turned off.
- SMS: off by default. Requires opting in and a phone number. Consent time is stored.
- Promotional email and SMS: off by default, separate switches.
- A skipped message is still logged, with the reason (`opted_out`, `no_phone`, `undeliverable_address`).

## 9. Refund policy

Implemented in `src/lib/refund-policy.ts`.

| Who cancels | When | Refund |
|---|---|---|
| Doctor, or doctor leave | Any time | 100% |
| Patient | More than 24 hours before | 100% |
| Patient | 4 to 24 hours before | 50% |
| Patient | Less than 4 hours before | 0% |

A refund is "initiated" at cancel time and "processed" only when Razorpay confirms it (webhook, or reconciliation when the patient opens Payment history). A payment that arrives after its slot was released is refunded in full automatically.

## 10. Doctor leave

A doctor can mark a day off from the dashboard (Days off section). Marking a day:

1. Records the leave day first, so no new booking can start for that date.
2. Releases unpaid holds on that date.
3. Cancels every booked appointment that day (appointments already started today are left alone), refunds in full and notifies each patient with the doctor-leave message.
4. Hides the date from available slots. Booking and rescheduling are refused for that date.

## 11. Operational procedures

Recent messages:

```sql
SELECT type, channel, status, attempts, last_error, recipient, created_at
FROM notification_log ORDER BY created_at DESC LIMIT 20;
```

Failures:

```sql
SELECT type, channel, status, attempts, left(last_error, 80) AS error, next_attempt_at
FROM notification_log WHERE status IN ('failed', 'dead') ORDER BY created_at DESC;
```

Duplicate check (should return no rows):

```sql
SELECT idempotency_key, channel, user_id, count(*)
FROM notification_log GROUP BY 1, 2, 3 HAVING count(*) > 1;
```

Retry dead messages after fixing the cause:

```sql
UPDATE notification_log SET status = 'failed', attempts = 0, next_attempt_at = now()
WHERE status = 'dead';
```

Then call the cron endpoint.

Reminder state:

```sql
SELECT r.kind, r.status, r.send_at, a.date, a.start_time, a.status AS appointment_status
FROM reminders r JOIN appointments a ON a.id = r.appointment_id
ORDER BY r.send_at DESC LIMIT 10;
```

Calling the cron endpoint by hand (PowerShell, secret read from `.env.local` so it is not printed):

```powershell
$s = (Select-String .env.local -Pattern '^CRON_SECRET=').Line.Split('=',2)[1]
Invoke-RestMethod -Uri http://localhost:3000/api/cron/reminders -Headers @{Authorization="Bearer $s"}
```

Rotating `CRON_SECRET`: set the new value in Vercel and in the pinger's Authorization header, then redeploy.

Common problems:

| Symptom | Likely cause |
|---|---|
| Email rows `failed`, `Invalid login` | Wrong or expired Gmail App Password, or `EMAIL_USER` does not match the account that created it |
| No email or SMS rows at all | Channel not configured, or the event is not wired to `emit` |
| `skipped`, `undeliverable_address` | Demo or fake address |
| `skipped`, `opted_out` or `no_phone` | Preferences or missing phone number |
| SMS `sent` but nothing on the phone | `SMS_PROVIDER=console` is a simulator |
| Email in Spam | Personal Gmail sender without domain authentication |
| Cron returns 401 | `CRON_SECRET` differs between the caller and the deployment |

## 12. Testing

`npm test` runs unit tests with Vitest:

- Slot generation and time helpers.
- Refund policy tiers and their boundaries.
- Template rendering, including a check that no medical detail leaks.
- Channel planning for preferences, opt-out, consent, promotional messages and undeliverable addresses.
- Retry backoff and the attempt limit.
- Reminder interval configuration.

Behaviour that depends on the database (idempotency, reminder scheduling and cancellation, retries, doctor leave) was verified manually against Neon with the queries in section 11.

## 13. Known limits

- Razorpay runs in test mode only.
- SMS is simulated unless Twilio is configured. MSG91 is implemented but untested. WhatsApp is not implemented.
- Gmail SMTP can land in Spam.
- The Neon HTTP driver has no transactions, so every state change is a single conditional update (`UPDATE ... WHERE status = X ... RETURNING`), and only the caller that wins continues.
- The Vercel Hobby plan allows one cron run per day, so frequent reminders rely on an external pinger.
