import "server-only";
import { db } from "@/lib/db";
import { decryptText } from "@/lib/security/encryption";
import { requireOrganizationContext } from "@/lib/tenant-context";
import { safeSetupConfiguration } from "./steps";

export async function getActiveSetupSection(section: string) {
  try { requireOrganizationContext(); } catch { return null; }
  const record = await db.organizationSetupSection.findFirst({ where: { section, activatedAt: { not: null } } });
  if (!record?.activeConfigurationJson) return null;
  return {
    configuration: safeSetupConfiguration(record.activeConfigurationJson),
    secrets: record.activeSecretEncrypted ? safeSetupConfiguration(decryptText(record.activeSecretEncrypted)) : {},
  };
}
