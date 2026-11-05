import nodemailer from "nodemailer";

const APP_URL = process.env.APP_URL ?? "https://hospital-management-system-nine-henna.vercel.app";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_APP_PASSWORD?.replace(/\s/g, ""); // Google shows it with spaces
  if (!user || !pass) return null;
  transporter ??= nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  return transporter;
}

export const emailConfigured = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function render(text: string) {
  return `<!doctype html><html><body style="margin:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#10231F">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
    <table width="520" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e3ebe8">
      <tr><td style="background:#0E6B58;padding:16px 24px;color:#ffffff;font-size:18px;font-weight:bold">Medrella</td></tr>
      <tr><td style="padding:24px">
        <p style="margin:0 0 20px;font-size:15px;line-height:1.5">${esc(text)}</p>
        <a href="${APP_URL}/patient" style="display:inline-block;background:#0E6B58;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">Open Medrella</a>
      </td></tr>
      <tr><td style="padding:14px 24px;background:#EAF5F1;font-size:12px;color:#5b6b66">
        This is an automated message from Medrella. You can change what you receive under Notification settings.
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

// Returns the provider message id
export async function sendEmail(input: { to: string; subject: string; text: string }) {
  const t = getTransporter();
  if (!t) throw new Error("Email is not configured");
  const info = await t.sendMail({
    from: `"Medrella" <${process.env.EMAIL_USER}>`,
    to: input.to,
    subject: input.subject,
    text: `${input.text}\n\nOpen Medrella: ${APP_URL}`,
    html: render(input.text),
  });
  return info.messageId as string;
}