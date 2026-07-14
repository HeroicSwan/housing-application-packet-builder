import { cookies } from "next/headers";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { db } from "@/lib/db";
import { sha256 } from "@/lib/security/encryption";
import { canAccessRole, type Role } from "./authorization";

const cookieName = "hapb_session";
const sessionSeconds = 60 * 60 * 8;

export async function createSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const requestHeaders = await headers();
  await db.authSession.create({ data: { userId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + sessionSeconds * 1000), ipHash: requestHeaders.get("x-forwarded-for") ? sha256(requestHeaders.get("x-forwarded-for")!.split(",")[0].trim()) : null, userAgent: requestHeaders.get("user-agent")?.slice(0, 300) } });
  const store = await cookies();
  store.set(cookieName, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: sessionSeconds });
}

export async function deleteSession() {
  const store = await cookies();
  const token = store.get(cookieName)?.value;
  if (token) await db.authSession.updateMany({ where: { tokenHash: sha256(token), revokedAt: null }, data: { revokedAt: new Date() } });
  store.delete(cookieName);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(cookieName)?.value;
  if (!token) return null;
  const session = await db.authSession.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true } } } });
  if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) return null;
  if (Date.now() - session.lastSeenAt.getTime() > 15 * 60 * 1000) await db.authSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

export async function requireRole(allowed: Role[]) {
  const user = await requireUser();
  if (!canAccessRole(user.role, allowed)) redirect("/unauthorized");
  return user;
}

export async function canAccessCase(user: { id: string; role: string }, clientCaseId: string) {
  if (user.role === "REVIEWER" || user.role === "ADMIN") return true;
  if (user.role !== "CASEWORKER") return false;
  return (await db.clientCase.count({ where: { id: clientCaseId, assignedCaseworkerId: user.id } })) === 1;
}

export async function canAccessPacket(user: { id: string; role: string }, packetId: string) {
  if (user.role === "REVIEWER" || user.role === "ADMIN") return true;
  if (user.role !== "CASEWORKER") return false;
  return (await db.applicationPacket.count({ where: { id: packetId, clientCase: { assignedCaseworkerId: user.id } } })) === 1;
}
