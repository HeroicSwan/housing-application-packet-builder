import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { verifySmtpConnection } from "@/lib/email";
import { probeClamAv } from "@/lib/security/malware";
import { decryptText } from "@/lib/security/encryption";
import { validateOutboundTarget } from "@/lib/security/outbound-target";
import { probeAiProvider } from "@/lib/setup/ai-probe";
import { safeSetupConfiguration } from "@/lib/setup/steps";
import { testDatabasePermissions } from "@/lib/database/preflight";
import { probeStorage } from "./storage";
import { probeMonitoring } from "./monitoring";
import { probeDelivery } from "./delivery";
import type { ConnectionTestResult } from "./types";
import type { StorageConfig } from "@/lib/storage";

export const setupConnectionTestSchema = z.enum(["smtp", "storage", "malware", "ai", "database", "monitoring", "backup", "delivery", "portal"]);
export type SetupConnectionTest = z.infer<typeof setupConnectionTestSchema>;

function secrets(value?: string | null) {
  return value ? safeSetupConfiguration(decryptText(value)) : {};
}

async function validateServiceHost(host: string, port: number) {
  if (env.DATA_MODE !== "production") return;
  const internal = env.INTERNAL_SERVICE_HOST_ALLOWLIST.includes(host.toLowerCase());
  await validateOutboundTarget(`https://${host}:${port}/`, internal ? { mode: "internal", allowedHosts: env.INTERNAL_SERVICE_HOST_ALLOWLIST, allowedPorts: [port] } : undefined);
}

async function validateStorageEndpoint(endpoint?: unknown) {
  if (env.DATA_MODE !== "production" || typeof endpoint !== "string" || !endpoint) return;
  const host = new URL(endpoint).hostname.toLowerCase();
  const internal = env.INTERNAL_SERVICE_HOST_ALLOWLIST.includes(host);
  await validateOutboundTarget(endpoint, internal ? { mode: "internal", allowedHosts: env.INTERNAL_SERVICE_HOST_ALLOWLIST, allowedPorts: [Number(new URL(endpoint).port || 443)] } : undefined);
}

function storageConfig(configuration: Record<string, unknown>, storedSecrets: Record<string, unknown>): StorageConfig {
  return { provider: configuration.provider === "s3" ? "s3" : "local", localRoot: String(configuration.localRoot ?? ".data/storage"), bucket: typeof configuration.bucket === "string" ? configuration.bucket : undefined, region: String(configuration.region ?? "us-east-1"), endpoint: typeof configuration.endpoint === "string" ? configuration.endpoint : undefined, accessKeyId: typeof configuration.accessKeyId === "string" ? configuration.accessKeyId : undefined, secretAccessKey: typeof storedSecrets.secretAccessKey === "string" ? storedSecrets.secretAccessKey : undefined };
}

async function execute(kind: SetupConnectionTest, sections: Map<string, { configurationJson: string; secretEncrypted: string | null }>): Promise<ConnectionTestResult> {
  const section = (name: string) => sections.get(name);
  if (kind === "smtp") {
    const record = section("smtp"); const config = safeSetupConfiguration(record?.configurationJson ?? "{}"); const secret = secrets(record?.secretEncrypted);
    if (typeof config.host !== "string" || !config.host) return { status: env.DATA_MODE === "production" ? "FAILED" : "SIMULATED", code: "SMTP_NOT_CONFIGURED", summary: "No SMTP service was configured; password recovery and email delivery remain unavailable.", durationMs: 0 };
    try { await validateServiceHost(config.host, Number(config.port)); } catch { return { status: "FAILED", code: "SMTP_TARGET_BLOCKED", summary: "The SMTP host is not allowed by the deployment outbound-service policy.", durationMs: 0 }; }
    const started = performance.now(); const result = await verifySmtpConnection({ host: config.host, port: Number(config.port), secure: config.secure === true, user: typeof config.user === "string" ? config.user : undefined, password: typeof secret.password === "string" ? secret.password : undefined });
    return { status: result.ok ? "PASSED" : "FAILED", code: result.code, summary: result.ok ? "SMTP DNS, transport security, and authentication were accepted without sending email." : "The SMTP service did not accept the saved connection settings.", durationMs: Math.round(performance.now() - started) };
  }
  if (kind === "storage" || kind === "backup") {
    const record = section("storage"); const config = safeSetupConfiguration(record?.configurationJson ?? "{}");
    try { await validateStorageEndpoint(config.endpoint); } catch { return { status: "FAILED", code: "STORAGE_TARGET_BLOCKED", summary: "The object-storage endpoint is not allowed by the deployment outbound-service policy.", durationMs: 0 }; }
    return probeStorage(storageConfig(config, secrets(record?.secretEncrypted)), kind === "backup" ? "setup-tests/backups" : "setup-tests/storage");
  }
  if (kind === "malware") {
    const config = safeSetupConfiguration(section("malware")?.configurationJson ?? "{}");
    if (config.scanner !== "clamav") return { status: env.DATA_MODE === "production" ? "FAILED" : "SIMULATED", code: "CLAMAV_DISABLED", summary: "Malware scanning is disabled and must be enabled before real-data use.", durationMs: 0 };
    try { await validateServiceHost(String(config.host), Number(config.port)); } catch { return { status: "FAILED", code: "CLAMAV_TARGET_BLOCKED", summary: "The ClamAV host is not allowed by the deployment outbound-service policy.", durationMs: 0 }; }
    const started = performance.now(); const result = await probeClamAv({ host: String(config.host), port: Number(config.port) });
    return { status: result.ok ? "PASSED" : "FAILED", code: result.code, summary: result.ok ? "ClamAV accepted clean synthetic content and detected the standard EICAR test signature." : "ClamAV did not complete both synthetic safety checks.", durationMs: Math.round(performance.now() - started) };
  }
  if (kind === "ai") {
    const record = section("ai"); const config = safeSetupConfiguration(record?.configurationJson ?? "{}"); const secret = secrets(record?.secretEncrypted); const started = performance.now();
    const result = await probeAiProvider({ provider: String(config.provider ?? "disabled") as never, model: typeof config.model === "string" ? config.model : undefined, apiKey: typeof secret.apiKey === "string" ? secret.apiKey : undefined, httpReferer: env.OPENROUTER_HTTP_REFERER, appTitle: env.OPENROUTER_APP_TITLE });
    return { status: result.status, code: result.code, summary: result.status === "PASSED" ? "The exact approved model was found and completed one minimal synthetic request." : result.status === "UNSUPPORTED" ? "AI processing is intentionally disabled; no applicant data will leave for an AI provider." : "The provider or exact model could not be verified with the saved settings.", durationMs: Math.round(performance.now() - started) };
  }
  if (kind === "database") return testDatabasePermissions();
  if (kind === "monitoring") {
    const record = section("operations"); const config = safeSetupConfiguration(record?.configurationJson ?? "{}"); const secret = secrets(record?.secretEncrypted);
    return probeMonitoring(typeof config.monitoringEndpoint === "string" ? config.monitoringEndpoint : null, typeof secret.monitoringToken === "string" ? secret.monitoringToken : undefined);
  }
  const record = section("delivery"); const config = safeSetupConfiguration(record?.configurationJson ?? "{}"); const secret = secrets(record?.secretEncrypted);
  if (kind === "portal" && config.type !== "PORTAL_API") return { status: "UNSUPPORTED", code: "PORTAL_NOT_SELECTED", summary: "No portal-assisted destination is selected.", durationMs: 0 };
  return probeDelivery({ type: String(config.type), endpoint: typeof config.endpoint === "string" ? config.endpoint : null, adapter: typeof config.adapter === "string" ? config.adapter : null, remoteTestAcknowledged: config.remoteTestAcknowledged === true }, typeof secret.authToken === "string" ? secret.authToken : undefined);
}

export async function runSetupConnectionTest(input: { organizationId: string; userId: string; kind: SetupConnectionTest }) {
  const records = await db.organizationSetupSection.findMany();
  const sections = new Map(records.map((record) => [record.section, record]));
  let result: ConnectionTestResult;
  try { result = await execute(input.kind, sections); } catch { result = { status: "FAILED", code: "CONNECTION_TEST_FAILED", summary: "The connection test failed safely. Check the saved configuration and service logs.", durationMs: 0 }; }
  const targets = input.kind === "ai" ? ["ai", "ai-model"] : [input.kind === "portal" ? "delivery" : input.kind];
  await db.$transaction([
    ...targets.map((section) => db.organizationSetupSection.upsert({ where: { organizationId_section: { organizationId: input.organizationId, section } }, create: { organizationId: input.organizationId, section, configurationJson: section === "ai-model" ? JSON.stringify({ source: "ai" }) : "{}", lastTestedAt: new Date(), lastTestStatus: result.status, lastTestCode: result.code, lastTestDurationMs: result.durationMs, lastTestSummary: result.summary, updatedById: input.userId }, update: { lastTestedAt: new Date(), lastTestStatus: result.status, lastTestCode: result.code, lastTestDurationMs: result.durationMs, lastTestSummary: result.summary, updatedById: input.userId } })),
    db.auditEvent.create({ data: { userId: input.userId, action: "SETUP_CONNECTION_TESTED", entityType: "OrganizationSetupSection", entityId: input.kind, metadata: `${input.kind} test ${result.status} (${result.code}); credentials, payloads, and provider responses not logged` } }),
  ]);
  return result;
}

export * from "./types";
