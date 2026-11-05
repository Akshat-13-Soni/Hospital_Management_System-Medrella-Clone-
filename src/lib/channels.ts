import { emailConfigured, sendEmail } from "./email";
import { sendSms, smsConfigured } from "./sms";

export type ChannelName = "email" | "sms";

export interface Channel {
  name: ChannelName;
  configured(): boolean;
  // Returns the provider's reference for the sent message
  send(address: string, msg: { subject: string; text: string }): Promise<string | undefined>;
}

// Demo accounts use fake addresses, so never try to deliver to them
export const isDeliverableEmail = (email: string) =>
  !/@(demo\.com|example\.com)$/i.test(email) && !email.endsWith(".test");

export const channels: Record<ChannelName, Channel> = {
  email: {
    name: "email",
    configured: emailConfigured,
    send: (address, msg) => sendEmail({ to: address, subject: msg.subject, text: msg.text }),
  },
  sms: {
    name: "sms",
    configured: smsConfigured,
    send: (address, msg) => sendSms(address, msg.text),
  },
};
// To add WhatsApp or push later: add a name here, a sender file like sms.ts, and one entry above.