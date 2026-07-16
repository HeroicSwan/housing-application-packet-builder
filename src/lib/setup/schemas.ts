import { z } from "zod";

const text = (minimum: number, maximum: number) => z.string().trim().min(minimum).max(maximum);
const optionalText = (maximum: number) => z.string().trim().max(maximum).transform((value) => value || null);

export const organizationSetupSchema = z.object({
  name: text(2, 160),
  jurisdiction: text(2, 160),
  contactName: text(2, 120),
  contactEmail: z.string().trim().toLowerCase().email().max(254),
  contactPhone: optionalText(40),
});

export const accessSetupSchema = z.object({
  requireMfa: z.boolean(),
  sessionDurationMinutes: z.number().int().min(15).max(1440),
  sessionIdleMinutes: z.number().int().min(5).max(240),
  passwordMinLength: z.number().int().min(12).max(128),
  passwordRequireUppercase: z.boolean(),
  passwordRequireNumber: z.boolean(),
}).refine((value) => value.sessionIdleMinutes <= value.sessionDurationMinutes, { path: ["sessionIdleMinutes"], message: "Idle timeout cannot be longer than the session lifetime." });

export const governanceSetupSchema = z.object({
  retentionDays: z.number().int().min(30).max(36500),
  documentRetentionDays: z.number().int().min(30).max(36500),
  auditRetentionDays: z.number().int().min(365).max(36500),
  deletionGraceDays: z.number().int().min(1).max(365),
  legalHoldPolicy: text(20, 2000),
  consentText: text(20, 4000).default("I consent to the approved supporting documents being shared for this application."),
  consentVersion: text(3, 120).default("document-release-v1"),
  signatureDisclaimer: text(20, 4000).default("Electronic signature acceptance depends on organization policy and applicable law."),
  signaturePolicy: z.enum(["TYPED", "TYPED_OR_DRAWN"]).default("TYPED"),
});

export const smtpSetupSchema = z.object({
  host: optionalText(253),
  port: z.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: optionalText(254),
  from: z.string().trim().email().max(254),
});

export const storageSetupSchema = z.object({
  provider: z.enum(["local", "s3"]),
  localRoot: text(1, 300),
  bucket: optionalText(255),
  region: text(2, 80),
  endpoint: optionalText(2048),
  accessKeyId: optionalText(512),
  privateBucketAcknowledged: z.boolean(),
}).superRefine((value, context) => {
  if (value.provider === "s3" && !value.bucket) context.addIssue({ code: "custom", path: ["bucket"], message: "A private bucket is required for S3 storage." });
  if (value.endpoint && !z.string().url().safeParse(value.endpoint).success) context.addIssue({ code: "custom", path: ["endpoint"], message: "Enter a valid object-storage endpoint URL." });
});

export const malwareSetupSchema = z.object({ scanner: z.enum(["none", "clamav"]), host: text(1, 253), port: z.number().int().min(1).max(65535) });

export const aiSetupSchema = z.object({
  provider: z.enum(["disabled", "anthropic", "gemini", "groq", "openrouter", "sambanova", "cerebras", "mistral"]),
  model: optionalText(200),
  approvalId: optionalText(200),
  providerRetentionAcknowledged: z.boolean(),
  dataProcessingAgreementAcknowledged: z.boolean(),
}).superRefine((value, context) => {
  if (value.provider !== "disabled" && !value.model) context.addIssue({ code: "custom", path: ["model"], message: "Select the exact approved model." });
  if (value.provider !== "disabled" && !value.approvalId) context.addIssue({ code: "custom", path: ["approvalId"], message: "Record the organization approval reference." });
  if (value.provider !== "disabled" && !value.providerRetentionAcknowledged) context.addIssue({ code: "custom", path: ["providerRetentionAcknowledged"], message: "Review and acknowledge the provider retention setting." });
});

export const operationsSetupSchema = z.object({
  monitoringEndpoint: optionalText(2048),
  alertContact: z.string().trim().email().max(254),
  backupSchedule: z.enum(["daily", "weekly"]),
  backupDestination: text(3, 2048),
  backupRetentionDays: z.number().int().min(7).max(3650),
  workerHealthUrl: optionalText(2048),
}).superRefine((value, context) => {
  for (const key of ["monitoringEndpoint", "workerHealthUrl"] as const) if (value[key] && !z.string().url().safeParse(value[key]).success) context.addIssue({ code: "custom", path: [key], message: "Enter a valid URL." });
});

export const deliverySetupSchema = z.object({
  type: z.enum(["MANUAL", "EMAIL", "API", "PORTAL_API"]),
  name: text(2, 120),
  recipient: optionalText(254),
  endpoint: optionalText(2048),
  adapter: optionalText(120),
  remoteTestAcknowledged: z.boolean(),
}).superRefine((value, context) => {
  if (value.type === "EMAIL" && !z.string().email().safeParse(value.recipient).success) context.addIssue({ code: "custom", path: ["recipient"], message: "Enter the approved recipient email address." });
  if (["API", "PORTAL_API"].includes(value.type) && (!value.endpoint || !z.string().url().safeParse(value.endpoint).success)) context.addIssue({ code: "custom", path: ["endpoint"], message: "Enter a valid destination URL." });
});

export function booleanField(formData: FormData, name: string) { return formData.get(name) === "on"; }
export function numberField(formData: FormData, name: string) { return Number(formData.get(name)); }
export function stringField(formData: FormData, name: string) { return String(formData.get(name) ?? ""); }
