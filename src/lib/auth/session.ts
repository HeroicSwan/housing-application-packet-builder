import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db, systemDb } from "@/lib/db";
import { sha256 } from "@/lib/security/encryption";
import { env } from "@/lib/env";
import { enterOrganizationContext, runWithOrganization } from "@/lib/tenant-context";
import { canAccessRole, type Role } from "./authorization";

const cookieName = "hapb_session";
export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const requestHeaders = await headers();
  const user = await systemDb.user.findUnique({ where: { id: userId }, select: { organizationId: true, organization: { select: { isActive: true, sessionDurationMinutes: true } } } });
  if (!user?.organizationId || !user.organization?.isActive) throw new Error("An active organization is required before a session can be created.");
  const sessionSeconds = user.organization.sessionDurationMinutes * 60;
  await systemDb.authSession.create({ data: { userId, organizationId: user.organizationId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + sessionSeconds * 1000), ipHash: requestHeaders.get("x-forwarded-for") ? sha256(requestHeaders.get("x-forwarded-for")!.split(",")[0].trim()) : null, userAgent: requestHeaders.get("user-agent")?.slice(0, 300) } });
  enterOrganizationContext(user.organizationId);
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: env.SECURE_COOKIES, path: "/", maxAge: sessionSeconds });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) await systemDb.authSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  store.delete(cookieName);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await systemDb.authSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true, mfaEnabled: true, organizationId: true, organization: { select: { isActive: true, sessionIdleMinutes: true, requireMfa: true } } } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive || !session.organizationId || session.user.organizationId !== session.organizationId || !session.user.organization?.isActive) return null;
  if (session.lastSeenAt.getTime() + session.user.organization.sessionIdleMinutes * 60_000 <= Date.now()) {
    await systemDb.authSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    return null;
  }
  if (Date.now() - session.lastSeenAt.getTime() > 15 * 60 * 1000) await systemDb.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  enterOrganizationContext(session.organizationId);
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role, organizationId: session.organizationId, mfaEnrollmentRequired: session.user.organization.requireMfa && !session.user.mfaEnabled };
}

export async function requireUser(options: { allowMfaEnrollment?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.mfaEnrollmentRequired && !options.allowMfaEnrollment) redirect("/account/security?required=1");
  return user;
}

export async function requireRole(allowed: Role[]) {
  const user = await requireUser();
  if (!canAccessRole(user.role, allowed)) redirect("/unauthorized");
  return user;
}

export function activateOrganizationContext<T extends { organizationId: string | null } | null>(user: T) {
  if (user && !user.organizationId) throw new Error("An organization is required for tenant-scoped access.");
  if (user?.organizationId) enterOrganizationContext(user.organizationId);
  return user;
}

export async function canAccessCase(user: { id: string; role: string; organizationId: string }, clientCaseId: string) {
  if (!["CASEWORKER", "REVIEWER", "SUPERVISOR", "AUDITOR", "ADMIN"].includes(user.role)) return false;
  return runWithOrganization(user.organizationId, async () => (await db.clientCase.count({ where: { id: clientCaseId, ...(user.role === "CASEWORKER" ? { assignedCaseworkerId: user.id } : {}) } })) === 1);
}

export async function canAccessPacket(user: { id: string; role: string; organizationId: string }, packetId: string) {
  if (!["CASEWORKER", "REVIEWER", "SUPERVISOR", "AUDITOR", "ADMIN"].includes(user.role)) return false;
  return runWithOrganization(user.organizationId, async () => (await db.applicationPacket.count({ where: { id: packetId, ...(user.role === "CASEWORKER" ? { clientCase: { assignedCaseworkerId: user.id } } : {}) } })) === 1);
}
