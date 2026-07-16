import nodemailer from "nodemailer";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "@/lib/env";
import { requireOrganizationContext } from "@/lib/tenant-context";

const defaultSmtpTimeoutMs = 15_000;

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  password?: string;
};

export type SmtpProbeResult =
  | { ok: true; code: "SMTP_CONNECTION_OK" }
  | { ok: false; code: "SMTP_CONNECTION_FAILED" };

async function resolveSmtpAddress(host: string) {
  if (isIP(host)) return host;
  const addresses = await lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("SMTP host did not resolve.");
  return addresses[0].address;
}

export function createSmtpTransport(config: SmtpConfig, timeoutMs = defaultSmtpTimeoutMs, pinnedAddress?: string) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
    dnsTimeout: timeoutMs,
    ...(pinnedAddress ? { lookup: (_hostname: string, _options: unknown, callback: (error: Error | null, address?: string, family?: number) => void) => callback(null, pinnedAddress, isIP(pinnedAddress) as 4 | 6) } : {}),
  });
}

export async function verifySmtpConnection(config: SmtpConfig, timeoutMs = defaultSmtpTimeoutMs): Promise<SmtpProbeResult> {
  const pinnedAddress = env.ENFORCE_PRODUCTION_CONFIG ? await resolveSmtpAddress(config.host) : undefined;
  const transport = createSmtpTransport(config, timeoutMs, pinnedAddress);
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      transport.verify(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("SMTP verification timed out.")), timeoutMs);
      }),
    ]);
    return { ok: true, code: "SMTP_CONNECTION_OK" };
  } catch {
    return { ok: false, code: "SMTP_CONNECTION_FAILED" };
  } finally {
    if (timer) clearTimeout(timer);
    transport.close();
  }
}

export function emailConfigured() {
  return Boolean(env.SMTP_HOST);
}

export async function emailConfiguredForOrganization() {
  if (env.SMTP_HOST) return true;
  const { getActiveSetupSection } = await import("@/lib/setup/active-config");
  return Boolean((await getActiveSetupSection("smtp"))?.configuration.host);
}

async function activeSmtpConfig(): Promise<SmtpConfig & { from: string }> {
  let hasOrganizationContext = true;
  try { requireOrganizationContext(); } catch { hasOrganizationContext = false; }
  if (!hasOrganizationContext && env.SMTP_HOST) return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.EMAIL_FROM };
  const active = hasOrganizationContext ? await (await import("@/lib/setup/active-config")).getActiveSetupSection("smtp") : null;
  if (!active) {
    if (!env.SMTP_HOST) throw new Error("Email delivery is not configured.");
    return { host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_SECURE, user: env.SMTP_USER, password: env.SMTP_PASSWORD, from: env.EMAIL_FROM };
  }
  const config = active.configuration;
  const secrets = active.secrets;
  if (typeof config.host !== "string" || !config.host) throw new Error("Email delivery is not configured.");
  return { host: config.host, port: Number(config.port), secure: config.secure === true, user: typeof config.user === "string" ? config.user : undefined, password: typeof secrets.password === "string" ? secrets.password : undefined, from: typeof config.from === "string" ? config.from : env.EMAIL_FROM };
}

export async function sendEmail(input: { to: string; subject: string; text: string; messageId?: string; attachments?: { filename: string; content: Buffer; contentType: string }[] }) {
  const smtp = await activeSmtpConfig();
  const pinnedAddress = env.ENFORCE_PRODUCTION_CONFIG ? await resolveSmtpAddress(smtp.host) : undefined;
  const transport = createSmtpTransport(smtp, defaultSmtpTimeoutMs, pinnedAddress);
  try {
    const result = await transport.sendMail({ from: smtp.from, ...input });
    return result.messageId;
  } finally {
    transport.close();
  }
}
