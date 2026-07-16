import "server-only";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { systemDb } from "@/lib/db";
import { env } from "@/lib/env";
import { sealAuditRows } from "@/lib/audit/chain";
import { sha256 } from "@/lib/security/encryption";

const bootstrapSchema = z.object({
  token: z.string().min(24).max(256),
  organizationName: z.string().trim().min(2).max(160),
  administratorName: z.string().trim().min(2).max(120),
  administratorEmail: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/[0-9]/),
});

function tokenMatches(token: string) {
  if (!env.SETUP_BOOTSTRAP_TOKEN_HASH) return false;
  const supplied = Buffer.from(sha256(token), "hex");
  const expected = Buffer.from(env.SETUP_BOOTSTRAP_TOKEN_HASH, "hex");
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function slugFor(name: string) {
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return slug || "organization";
}

export async function installationClaimStatus() {
  const [organizations, users] = await Promise.all([systemDb.organization.count(), systemDb.user.count()]);
  return { available: organizations === 0 && users === 0 && Boolean(env.SETUP_BOOTSTRAP_TOKEN_HASH), claimed: organizations > 0 || users > 0, tokenConfigured: Boolean(env.SETUP_BOOTSTRAP_TOKEN_HASH) };
}

export async function bootstrapInstallation(input: unknown) {
  const parsed = bootstrapSchema.parse(input);
  if (!tokenMatches(parsed.token)) throw new Error("The installation claim was not accepted.");
  const organizationId = crypto.randomUUID();
  const administratorId = crypto.randomUUID();
  const auditId = crypto.randomUUID();
  const passwordHash = await bcrypt.hash(parsed.password, 12);
  const slug = `${slugFor(parsed.organizationName)}-${organizationId.slice(0, 8)}`;

  if (env.DATABASE_URL.startsWith("postgres")) {
    try {
      await systemDb.$queryRaw(Prisma.sql`SELECT app_private.bootstrap_installation(${organizationId}, ${slug}, ${parsed.organizationName}, ${administratorId}, ${parsed.administratorName}, ${parsed.administratorEmail}, ${passwordHash}, ${auditId})`);
    } catch {
      throw new Error("This installation is already claimed or cannot be initialized with the configured database role.");
    }
    return { organizationId, userId: administratorId };
  }

  try {
    await systemDb.$transaction(async (tx) => {
      const [organizations, users] = await Promise.all([tx.organization.count(), tx.user.count()]);
      if (organizations || users) throw new Error("claimed");
      await tx.organization.create({ data: { id: organizationId, slug, name: parsed.organizationName, installationBootstrapKey: "PRIMARY_INSTALLATION" } });
      await tx.user.create({ data: { id: administratorId, organizationId, name: parsed.administratorName, email: parsed.administratorEmail, passwordHash, role: "ADMIN" } });
      const [audit] = sealAuditRows([{ id: auditId, organizationId, userId: administratorId, action: "INSTALLATION_BOOTSTRAPPED", entityType: "Organization", entityId: organizationId, metadata: "First administrator created; bootstrap credential was not stored" }], organizationId, null);
      await tx.auditEvent.create({ data: audit as never });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch {
    throw new Error("This installation is already claimed or could not be initialized.");
  }
  return { organizationId, userId: administratorId };
}
