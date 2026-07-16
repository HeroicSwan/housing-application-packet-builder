import { z } from "zod";

export const setupStepIds = ["organization", "access", "governance", "services", "ai", "operations", "delivery", "review"] as const;
export type SetupStepId = (typeof setupStepIds)[number];

export const setupSteps: { id: SetupStepId; label: string; summary: string }[] = [
  { id: "organization", label: "Organization", summary: "Identity, jurisdiction, and responsible contact" },
  { id: "access", label: "Access & security", summary: "Administrator, staff roles, MFA, sessions, and passwords" },
  { id: "governance", label: "Data governance", summary: "Retention periods and legal holds" },
  { id: "services", label: "Email, storage & scanning", summary: "SMTP, private storage, and malware protection" },
  { id: "ai", label: "AI processing", summary: "Approved provider, model, and retention decision" },
  { id: "operations", label: "Operations", summary: "Encryption, database, monitoring, and backups" },
  { id: "delivery", label: "Submission", summary: "Email, API, portal, and manual destinations" },
  { id: "review", label: "Review & sign-off", summary: "Readiness blockers and organization acknowledgement" },
];

export const setupStepSchema = z.enum(setupStepIds);

export function nextSetupStep(step: SetupStepId) {
  return setupStepIds[Math.min(setupStepIds.indexOf(step) + 1, setupStepIds.length - 1)];
}

export function previousSetupStep(step: SetupStepId) {
  return setupStepIds[Math.max(setupStepIds.indexOf(step) - 1, 0)];
}

export function safeSetupConfiguration(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && !Array.isArray(parsed) && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}
