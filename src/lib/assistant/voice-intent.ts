const YES = new Set([
  "yes", "yeah", "yep", "confirm", "yes confirm", "yes please", "ok", "okay", "sure",
  "haan", "han", "ha", "haa", "haan kar do", "हाँ", "हां", "हा", "हाँ कर दो", "कन्फर्म", "ठीक है",
]);
const NO = new Set(["no", "nope", "cancel", "no cancel", "stop", "nahi", "nahin", "na", "नहीं", "नही", "रद्द करो", "मत करो"]);

const norm = (s: string) => s.toLowerCase().replace(/[.,!?।'"]/g, "").replace(/\s+/g, " ").trim();

// Only a whole short phrase counts, so a long sentence that happens to contain "yes" never confirms anything
export function voiceIntent(text: string): "yes" | "no" | null {
  const n = norm(text);
  return YES.has(n) ? "yes" : NO.has(n) ? "no" : null;
}