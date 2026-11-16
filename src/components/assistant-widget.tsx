"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelAssistantAction, confirmAssistantAction } from "@/actions/assistant";
import { abandonPayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { useVoice, type VoiceLang } from "@/lib/assistant/use-voice";
import { voiceIntent } from "@/lib/assistant/voice-intent";
import { loadRazorpay, runCheckout } from "@/lib/razorpay-checkout";

type Msg = { role: "user" | "assistant"; content: string };
type Pending = { id: string; summary: string };

// Models sometimes write special non-breaking spaces, which cannot wrap or be read aloud cleanly
const clean = (s: string) => s.replace(/[\u202f\u00a0\u2009]/g, " ");

const CHIPS: Record<"patient" | "doctor", string[]> = {
  patient: ["Show my upcoming appointments", "Find a cardiologist", "What are my payments?"],
  doctor: ["What are my appointments today?", "Any conflicts?", "When is my next free slot?"],
};

const CONFIRM_HINT: Record<VoiceLang, string> = {
  en: "Say yes to confirm, or no to cancel.",
  hi: "पुष्टि के लिए हाँ बोलें, रद्द करने के लिए नहीं।",
  hinglish: "Confirm karne ke liye haan boliye, cancel karne ke liye nahi.",
};

export function AssistantWidget({ role }: { role: "patient" | "doctor" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<VoiceLang>("en");
  const [headphones, setHeadphones] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const listeningRef = useRef(false);
  const onVoiceRef = useRef<(t: string) => void>(() => {});

  const voice = useVoice({ lang, headphones, onFinal: (t) => onVoiceRef.current(t) });
  const { speak, stop: stopMic, stopSpeaking, listening } = voice;

  useEffect(() => {
    listeningRef.current = listening;
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, busy, open]);

  useEffect(() => {
    if (!open) {
      stopMic();
      stopSpeaking();
    }
  }, [open, stopMic, stopSpeaking]);

  const say = (content: string) => {
    const text = clean(content);
    setMessages((m) => [...m, { role: "assistant", content: text }]);
    if (listeningRef.current) speak(text);
  };

  async function send(text: string) {
    const t = text.trim();
    if (!t || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      // A new message replaces any change that was waiting for confirmation
      if (pending) {
        await cancelAssistantAction(pending.id);
        setPending(null);
      }
      const next: Msg[] = [...messages, { role: "user", content: t }];
      setMessages(next);
      setInput("");
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, messages: next.slice(-20).map((m) => ({ ...m, content: m.content.slice(0, 1500) })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }
      const reply = clean(data.reply || "Sorry, I have no answer for that.");
      setMessages([...next, { role: "assistant", content: reply }]);
      setPending(data.pending ?? null);
      if (listeningRef.current) {
        speak(data.pending ? `${clean(data.pending.summary)} ${CONFIRM_HINT[lang]}` : reply);
      }
    } catch {
      setError("Could not reach the assistant. Check your connection.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending || busyRef.current) return;
    const p = pending;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await confirmAssistantAction(p.id);
      setPending(null);
      if (!res.ok) {
        say(res.message);
      } else if (res.checkout) {
        say("Opening the payment window. Your slot is held for a few minutes.");
        if (!(await loadRazorpay())) {
          await abandonPayment(res.checkout.orderId);
          say("I could not load the payment window, so the slot was released. Please try again.");
        } else {
          const outcome = await runCheckout(res.checkout);
          if (outcome === "paid") {
            say("Payment received. Your appointment is confirmed.");
          } else if (outcome === "dismissed") {
            await abandonPayment(res.checkout.orderId);
            say("Payment was cancelled, so the slot has been released.");
          } else {
            say("I could not confirm your payment yet. If money was deducted, the booking will appear in My appointments shortly.");
          }
        }
      } else {
        say(res.message);
      }
      router.refresh();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancel() {
    if (!pending || busyRef.current) return;
    const p = pending;
    setPending(null);
    await cancelAssistantAction(p.id);
    say("Okay, I cancelled that. Nothing was changed.");
  }

  // Latest handler for speech. Yes or no only counts while a confirm card is showing.
  useEffect(() => {
    onVoiceRef.current = (text: string) => {
      const t = text.trim();
      if (!t || busyRef.current) return;
      const intent = pending ? voiceIntent(t) : null;
      if (intent) {
        setMessages((m) => [...m, { role: "user", content: t }]);
        if (intent === "yes") void confirm();
        else void cancel();
        return;
      }
      void send(t);
    };
  });

  function toggleMic() {
    if (listening) {
      stopMic();
      stopSpeaking();
    } else {
      voice.start();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0E6B58] text-2xl text-white shadow-lg hover:bg-[#0B5646] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E6B58] focus-visible:ring-offset-2"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Medrella assistant"
          className="fixed inset-x-3 bottom-24 z-50 flex max-h-[75vh] flex-col overflow-hidden rounded-2xl border bg-background shadow-xl sm:inset-x-auto sm:right-5 sm:w-[390px]"
        >
          <header className="border-b bg-[#0E6B58] px-4 py-3 text-white">
            <p className="font-semibold">Medrella assistant</p>
            <p className="text-xs text-white/80">Changes only happen after you confirm</p>
          </header>

          {voice.supported && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b bg-muted/40 px-4 py-2 text-xs">
              <label className="flex items-center gap-1">
                Language
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as VoiceLang)}
                  className="rounded border bg-background px-1 py-0.5"
                >
                  <option value="en">English</option>
                  <option value="hi">हिन्दी</option>
                  <option value="hinglish">Hinglish</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={headphones} onChange={(e) => setHeadphones(e.target.checked)} />
                Headphones (speak to interrupt)
              </label>
            </div>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-3 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Hi, how can I help? You can type, or use the microphone. Try:</p>
                <div className="flex flex-wrap gap-2">
                  {CHIPS[role].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => send(c)}
                      className="rounded-full border bg-[#EAF5F1] px-3 py-1 text-xs text-[#0E6B58] hover:border-[#0E6B58]"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <p
                  className={
                    "max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 " +
                    (m.role === "user" ? "bg-[#0E6B58] text-white" : "bg-muted text-foreground")
                  }
                >
                  {clean(m.content)}
                </p>
              </div>
            ))}

            {pending && (
              <div className="rounded-xl border-2 border-[#0E6B58] bg-[#EAF5F1] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0E6B58]">Please confirm</p>
                <p className="mt-1 break-words text-[#10231F]">{clean(pending.summary)}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={confirm} disabled={busy} className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">
                    Confirm
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>
                    Cancel
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">This request expires in 5 minutes.</p>
              </div>
            )}

            {busy && <p className="text-xs text-muted-foreground">Working on it...</p>}
            {error && (
              <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          {(listening || voice.speaking || voice.micError) && (
            <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-4 py-2 text-xs">
              <span role="status" className="min-w-0 break-words">
                {voice.micError ??
                  (voice.speaking ? "Speaking..." : voice.interim ? `Hearing: ${voice.interim}` : "Listening... just speak")}
              </span>
              {voice.speaking && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="shrink-0 rounded border px-2 py-0.5 font-medium hover:border-[#0E6B58]"
                >
                  Stop
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2 border-t px-3 py-3">
            {voice.supported && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Start voice conversation"}
                className={
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg " +
                  (listening ? "animate-pulse border-red-500 bg-red-50" : "bg-background hover:border-[#0E6B58]")
                }
              >
                🎤
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              maxLength={500}
              placeholder="Type a message"
              aria-label="Message"
              className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            />
            <Button onClick={() => send(input)} disabled={busy || !input.trim()} className="bg-[#0E6B58] text-white hover:bg-[#0B5646]">
              Send
            </Button>
          </div>
        </section>
      )}
    </>
  );
}