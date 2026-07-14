import nodemailer from "nodemailer";
import { env } from "@/lib/env";

export function emailConfigured() {
  return Boolean(env.SMTP_HOST);
}

export async function sendEmail(input: { to: string; subject: string; text: string; attachments?: { filename: string; content: Buffer; contentType: string }[] }) {
  if (!env.SMTP_HOST) throw new Error("Email delivery is not configured.");
  const transport = nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, auth: env.SMTP_USER && env.SMTP_PASSWORD ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined });
  const result = await transport.sendMail({ from: env.EMAIL_FROM, ...input });
  return result.messageId;
}
