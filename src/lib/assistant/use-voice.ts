"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLang = "en" | "hi" | "hinglish";

// Hinglish is recognised as Hindi and spoken back with an Indian English voice
const RECOGNITION_LANG: Record<VoiceLang, string> = { en: "en-IN", hi: "hi-IN", hinglish: "hi-IN" };
const SPEECH_LANG: Record<VoiceLang, string> = { en: "en-IN", hi: "hi-IN", hinglish: "en-IN" };

type Options = { lang: VoiceLang; headphones: boolean; onFinal: (text: string) => void };

const getRecognition = (): any =>
  typeof window === "undefined" ? undefined : (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export function useVoice({ lang, headphones, onFinal }: Options) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  const recRef = useRef<any>(null);
  const wantRef = useRef(false); // the user wants the mic on
  const speakingRef = useRef(false);
  const opts = useRef({ lang, headphones, onFinal });
  useEffect(() => {
    opts.current = { lang, headphones, onFinal };
  });

  useEffect(() => {
    setSupported(!!getRecognition() && "speechSynthesis" in window);
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.getVoices(); // voices load lazily
    const warm = () => synth.getVoices();
    synth.addEventListener?.("voiceschanged", warm);
    return () => synth.removeEventListener?.("voiceschanged", warm);
  }, []);

  // While the assistant talks through speakers, the mic is paused so it cannot hear itself
  const micPaused = () => speakingRef.current && !opts.current.headphones;

  const startRec = useCallback(() => {
    const SR = getRecognition();
    if (!SR || recRef.current) return;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = RECOGNITION_LANG[opts.current.lang];

    rec.onresult = (e: any) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = String(r[0].transcript).trim();
        if (!r.isFinal) {
          partial += text;
          continue;
        }
        if (!text) continue;
        if (speakingRef.current) {
          if (!opts.current.headphones) continue; // could be the assistant's own voice
          window.speechSynthesis.cancel(); // headphones: the user is interrupting
        }
        setInterim("");
        opts.current.onFinal(text);
      }
      setInterim(partial);
    };

    rec.onerror = (e: any) => {
      const fatal: Record<string, string> = {
        "not-allowed": "Microphone permission was denied. Allow it in the browser and try again.",
        "service-not-allowed": "Voice input is blocked in this browser. Try Chrome or Edge.",
        network: "Voice input needs Google's speech service, which this browser blocks or cannot reach. Try Chrome or Edge.",
        "audio-capture": "No microphone was found.",
      };
      if (fatal[e.error]) {
        wantRef.current = false;
        setListening(false);
        setMicError(fatal[e.error]);
      }
    };

    rec.onend = () => {
      recRef.current = null;
      setInterim("");
      // Chrome ends continuous sessions by itself, so restart while the user wants the mic on
      if (wantRef.current && !micPaused()) startRec();
    };

    recRef.current = rec;
    try {
      rec.start();
    } catch {
      recRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setMicError(null);
    wantRef.current = true;
    setListening(true);
    if (!micPaused()) startRec();
  }, [startRec]);

  const stop = useCallback(() => {
    wantRef.current = false;
    setListening(false);
    setInterim("");
    try {
      recRef.current?.stop();
    } catch {}
  }, []);

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = window.speechSynthesis;
      if (!synth || !text.trim()) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const lang = SPEECH_LANG[opts.current.lang];
      u.lang = lang;
      const voices = synth.getVoices();
      const v = voices.find((x) => x.lang === lang) ?? voices.find((x) => x.lang.startsWith(lang.slice(0, 2)));
      if (v) u.voice = v;
      u.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        if (!opts.current.headphones) {
          try {
            recRef.current?.stop();
          } catch {}
        }
      };
      const done = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (wantRef.current) startRec();
      };
      u.onend = done;
      u.onerror = done;
      synth.speak(u);
    },
    [startRec]
  );

  // Switching language while listening restarts recognition in the new language
  useEffect(() => {
    if (wantRef.current) {
      try {
        recRef.current?.stop();
      } catch {}
    }
  }, [lang]);

  useEffect(
    () => () => {
      wantRef.current = false;
      try {
        recRef.current?.abort();
      } catch {}
      window.speechSynthesis?.cancel();
    },
    []
  );

  return { supported, listening, speaking, interim, micError, start, stop, speak, stopSpeaking };
}