"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cancelAssistantAction, confirmAssistantAction } from "@/actions/assistant";
import { abandonPayment } from "@/actions/payments";
import { Button } from "@/components/ui/button";
import { loadRazorpay, runCheckout } from "@/lib/razorpay-checkout";

type Msg = { role: "user" | "assistant"; content: string };
type Pending = { id: string; summary: string };

const CHIPS: Record<"patient" | "doctor", string[]> = {
  patient: ["Show my upcoming appointments", "Find a cardiologist", "What are my payments?"],
  doctor: ["What are my appointments today?", "Any conflicts?", "When is my next free slot?"],
};

export function AssistantWidget({ role }: { role: "patient" | "doctor" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, busy, open]);

  const say = (content: string) => setMessages((m) => [...m, { role: "assistant", content }]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setError(null);
    // A new message replaces any change that was waiting for confirmation
    if (pending) {
      await cancelAssistantAction(pending.id);
      setPending(null);
    }
    const next: Msg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20).map((m) => ({ ...m, content: m.content.slice(0, 1500) })) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        setMessages([...next, { role: "assistant", content: data.reply || "Sorry, I have no answer for that." }]);
        setPending(data.pending ?? null);
      }
    } catch {
      setError("Could not reach the assistant. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!pending || busy) return;
    const p = pending;
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
      setBusy(false);
    }
  }

  async function cancel() {
    if (!pending) return;
    await cancelAssistantAction(pending.id);
    setPending(null);
    say("Okay, I cancelled that. Nothing was changed.");
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

          <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-3 text-sm" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-muted-foreground">Hi, how can I help? You can try:</p>
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
                  {m.content.replace(/[\u202f\u00a0\u2009]/g, " ")}
                </p>
              </div>
            ))}

            {pending && (
              <div className="rounded-xl border-2 border-[#0E6B58] bg-[#EAF5F1] p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#0E6B58]">Please confirm</p>
                <p className="mt-1 text-[#10231F]">{pending.summary}</p>
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

          <div className="flex gap-2 border-t px-3 py-3">
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