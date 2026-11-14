# AI voice and chat assistant

A chat and voice assistant for patients and doctors. It performs real operations through the existing backend code. It does not return mock data, and it never changes anything without the user's explicit confirmation.

## 1. What it can do

**Patient**

- View upcoming and past appointments.
- Search doctors by name or specialization.
- Check available slots and get alternative slots when the wanted time is taken.
- Book, reschedule and cancel appointments (each needs confirmation).
- Pay for paid appointments (the same Razorpay checkout as the booking page).
- View payment history and refund status.

**Doctor** (read and suggest only)

- View appointments for today or any date.
- Appointment statistics (booked, completed, cancelled).
- Working hours, wave and stream schedules, and leave days.
- Detect scheduling problems: overlapping appointments, appointments outside current hours, appointments on leave days.
- Suggest slots to reschedule an appointment to, and find the next free slot.

**Not supported: prescriptions.** The platform has no prescriptions feature, so the assistant says so instead of inventing data.

## 2. How it works

```
Browser (chat or voice)
   -> POST /api/assistant  (session cookie identifies the user)
        -> model (OpenAI-compatible chat completions with tool calling)
        -> tool calls run on the server as the logged-in user
        -> read tools return data; write tools only PROPOSE a change
   <- reply (+ a pending change, if any)
Browser shows a Confirm / Cancel card
   -> confirmAssistantAction(id)  (server action)
        -> claims the pending change, re-checks everything, then calls the existing booking / reschedule / cancel code
```

Files: `src/lib/assistant/` (`tools.ts`, `pending.ts`, `llm.ts`, `prompt.ts`, `slot-suggest.ts`, `voice-intent.ts`, `use-voice.ts`), `src/app/api/assistant/route.ts`, `src/actions/assistant.ts`, `src/components/assistant-widget.tsx`, `src/lib/razorpay-checkout.ts`.

## 3. Security and validation

| Requirement | How it is enforced |
|---|---|
| Explicit confirmation before booking, cancelling or rescheduling | Write tools never act. They create a row in `assistant_actions` (status `pending`, expires after 5 minutes) and the user must press Confirm, or say yes while the card is showing. |
| Revalidate slot availability | On confirm, the existing `bookAppointment` and `rescheduleAppointment` re-check availability at that moment. Seats in a slot are locked by the database (unique index on doctor, date, start time and seat). |
| Authorized data only | The user id and role come from the session, never from the model. No tool accepts a user, patient or doctor id from the model. Patients and doctors get different tool lists. Appointment tools check ownership. |
| Protect sensitive information | Tools return minimal fields. The reason for a visit, other people's emails and payment ids are never returned to the model. |
| Expired confirmations | Confirmation is a single conditional update (`pending` to `confirmed` where not expired). A late or repeated confirm is refused with a clear message. Only the newest proposal can be confirmed, and sending a new message cancels the old one. |
| Failed payments | If checkout is dismissed or fails to load, the held slot is released. If verification fails but money was taken, the user is told it will appear shortly, because the payment webhook is the source of truth. |
| Malformed requests | Every tool argument is validated with zod. Unknown tools or tools of the other role do not exist for the caller. |

The `assistant_actions` table is an audit trail: tool, arguments, summary, status (`pending`, `confirmed`, `cancelled`, `expired`, `failed`) and result.

## 4. Voice

Voice uses the browser's built-in speech recognition and speech synthesis. No extra speech API or cost.

- **Continuous conversation.** One microphone toggle. Recognition restarts itself, because browsers end continuous sessions on their own.
- **Languages.** English (`en-IN`), Hindi (`hi-IN`) and Hinglish (recognised as Hindi and spoken with an Indian English voice). The chosen language is sent to the model so it replies in that style.
- **Interrupt.** A Stop button stops speech at once. In Headphones mode, speaking over the assistant interrupts it.
- **Not hearing itself.** By default the microphone is paused while the assistant speaks. Headphones mode keeps it on.
- **Voice confirmation.** While a confirm card is showing, a short whole phrase such as "yes", "haan", "no" or "nahi" confirms or cancels. A longer sentence that merely contains "yes" does nothing. The buttons always work.

Limits:

- Speech recognition works best in Chrome and Edge. Some browsers block or lack the speech service, and the microphone shows an error. Typing always works.
- Hinglish recognition accuracy varies by accent and browser.
- Speech audio goes to the browser vendor's recognition service, and the conversation text goes to the AI provider.
- With speakers (not headphones), the assistant cannot be interrupted by voice, only with the Stop button.
- Microphone access needs HTTPS. `localhost` is allowed.

## 5. Setup

1. Create the table (run once in the Neon SQL editor):

```sql
CREATE TABLE assistant_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool text NOT NULL,
  args jsonb NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired', 'failed')),
  expires_at timestamptz NOT NULL,
  result text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX assistant_actions_user ON assistant_actions (user_id, status);
```

2. Set the model environment variables (locally in `.env.local`, and in Vercel, then redeploy):

| Name | Purpose |
|---|---|
| `AI_BASE_URL` | Base URL of an OpenAI-compatible chat completions API (without `/chat/completions`) |
| `AI_API_KEY` | API key. Server only. Never commit it or put it in client code. |
| `AI_MODEL` | Model name. It must support tool (function) calling. |

Any provider with an OpenAI-compatible endpoint and tool calling can be used by changing these three values. No code change is needed.

If the variables are missing, the endpoint answers "The assistant is not set up yet" (HTTP 503).

## 6. Reliability and cost

- At most 5 model calls per message, 600 output tokens per call, and at most 20 messages of history sent.
- Rate limit of 30 messages per user per 10 minutes. It is held in memory per server instance, so it is a cost guard, not a strict security control.
- Temporary provider errors (HTTP 429 and 5xx) and malformed tool calls (`tool_use_failed`) are retried up to two more times with a short wait.
- A 25-second timeout per model call. Failures return a friendly message and the real reason is logged on the server.
- In development only, the error response includes a `debug` field. It is never sent when `NODE_ENV` is `production`.

## 7. Operations

Recent assistant actions:

```sql
SELECT tool, status, summary, result, created_at
FROM assistant_actions ORDER BY created_at DESC LIMIT 20;
```

Pending actions that were never answered expire automatically (the next confirm attempt marks them `expired`).

Common problems:

| Symptom | Likely cause |
|---|---|
| 503 "not set up" | The three `AI_` variables are missing in this environment |
| 502 with `tool_use_failed` | The model wrote a malformed tool call. Retrying usually works. If it repeats, use a model with more reliable tool calling. |
| 502 with 429 | Provider rate limit or quota reached |
| 401 from the provider | Wrong or expired API key |
| Microphone error about the service | The browser blocks or lacks speech recognition. Use Chrome or Edge, or type. |

## 8. Testing

`npm test` includes unit tests for role scoping of tools, rejection of malformed arguments, that no tool takes a user id from the model, that only the write tools can be confirmed, slot suggestion helpers, overlap detection, and voice confirmation phrases.

Verified manually: cancel with Confirm, cancel with the Cancel button, expiry after 5 minutes, refund amounts matching the refund policy, doctor requests to change data being refused, and the audit rows in `assistant_actions`.

## 9. Known limits

- No prescriptions (the platform has none).
- Doctors can view and get suggestions, but cannot book, cancel or reschedule through the assistant.
- Only one change can wait for confirmation at a time.
- Voice depends on the browser's speech support, and the assistant's language quality depends on the chosen model.
- Conversation text is sent to the AI provider. Tools return minimal fields to limit what is shared.
