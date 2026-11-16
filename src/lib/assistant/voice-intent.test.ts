import { describe, expect, it } from "vitest";
import { voiceIntent } from "./voice-intent";

describe("voiceIntent", () => {
  it("accepts short yes phrases in English, Hindi and Hinglish", () => {
    for (const t of ["Yes", "yes, confirm", "Okay.", "haan", "Haan kar do", "हाँ"]) expect(voiceIntent(t), t).toBe("yes");
  });
  it("accepts short no phrases", () => {
    for (const t of ["No", "cancel", "nahi", "नहीं"]) expect(voiceIntent(t), t).toBe("no");
  });
  it("ignores long sentences that merely contain a yes or no", () => {
    expect(voiceIntent("yes please move it to tomorrow at ten")).toBeNull();
    expect(voiceIntent("I do not know")).toBeNull();
    expect(voiceIntent("book an appointment")).toBeNull();
  });
});