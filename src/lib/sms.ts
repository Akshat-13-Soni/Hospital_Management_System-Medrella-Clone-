export function smsConfigured() {
  const p = process.env.SMS_PROVIDER;
  if (p === "console") return true;
  if (p === "twilio") {
    return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
  }
  return false;
}

// Returns the provider's message reference
export async function sendSms(to: string, body: string): Promise<string> {
  const provider = process.env.SMS_PROVIDER;

  if (provider === "console") {
    // Simulated provider for demos and tests: nothing leaves the server
    console.log(`[sms:console] to=${to} body=${body}`);
    return `console-${Date.now()}`;
  }

  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body }),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { sid: string };
    return data.sid;
  }

  throw new Error("SMS provider is not configured");
}