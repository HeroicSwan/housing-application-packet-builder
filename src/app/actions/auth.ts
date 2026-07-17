"use server";

import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateSecret, verify } from "otplib";
import { db as tenantDb, systemDb as db } from "@/lib/db";
import { activateOrganizationContext, createSession, deleteSession, getCurrentUser } from "@/lib/auth/session";
import { checkRateLimit } from "@/lib/auth/rate-limit";
import { env } from "@/lib/env";
import { recordAudit } from "@/lib/audit";
import { emailConfigured, sendEmail } from "@/lib/email";
import { decryptText, encryptText, sha256 } from "@/lib/security/encryption";
import { z } from "zod";

const mfaCookie = "hapb_mfa_challenge";
let dummyPasswordHashPromise: Promise<string> | undefined;

function dummyPasswordHash() {
  dummyPasswordHashPromise ??= bcrypt.hash(crypto.randomBytes(32).toString("base64url"), 12);
  return dummyPasswordHashPromise;
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!(await checkRateLimit(`login:${email || "anonymous"}`))) redirect("/?error=Too+many+attempts.+Try+again+in+one+minute.");
  const user = await db.user.findUnique({ where: { email }, include: { organization: { select: { requireMfa: true } } } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) redirect("/?error=This+account+is+temporarily+locked.+Try+again+later.");
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : await bcrypt.compare(password, await dummyPasswordHash());
  if (!user || !user.isActive || !valid) {
    if (user) {
      const updated = await db.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 } }, select: { failedLoginCount: true } });
      if (updated.failedLoginCount >= 5) await db.user.updateMany({ where: { id: user.id, failedLoginCount: { gte: 5 } }, data: { lockedUntil: new Date(Date.now() + 15 * 60 * 1000) } });
    }
    redirect("/?error=Email+or+password+was+not+recognized.");
  }
  await db.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } });
  if (user.mfaEnabled) {
    const challenge = crypto.randomBytes(32).toString("base64url"); await db.mfaChallenge.create({ data: { userId: user.id, tokenHash: sha256(challenge), expiresAt: new Date(Date.now() + 5 * 60 * 1000) } }); (await cookies()).set(mfaCookie, challenge, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300 }); redirect("/mfa");
  }
  await createSession(user.id);
  activateOrganizationContext(user);
  await recordAudit({ userId: user.id, action: "LOGIN_SUCCEEDED", entityType: "User", entityId: user.id, metadata: `Local demonstration login for role ${user.role}` });
  if (user.organization?.requireMfa && !user.mfaEnabled) redirect("/account/security?required=1");
  redirect("/dashboard");
}

export async function demoLoginAction(formData: FormData) {
  if (!env.ENABLE_DEMO_LOGIN) redirect("/?error=One-click+demo+login+is+disabled.");
  const role = String(formData.get("role") ?? "CASEWORKER");
  const email = role === "REVIEWER" ? "reviewer@example.org" : role === "ADMIN" ? "admin@example.org" : "caseworker@example.org";
  const user = await db.user.findUnique({ where: { email } });
  if (!user) redirect("/?error=Run+npm+run+db%3Asetup+to+create+demo+accounts.");
  await createSession(user.id);
  activateOrganizationContext(user);
  await recordAudit({ userId: user.id, action: "LOGIN_SUCCEEDED", entityType: "User", entityId: user.id, metadata: `One-click demonstration login for role ${user.role}` });
  redirect("/dashboard");
}

export async function logoutAction() {
  const user = activateOrganizationContext(await getCurrentUser());
  if (user) await recordAudit({ userId: user.id, action: "LOGOUT", entityType: "User", entityId: user.id, metadata: "Local demonstration session ended" });
  await deleteSession();
  redirect("/");
}

export async function requestPasswordResetAction(formData: FormData) {
  const email = z.string().email().parse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!(await checkRateLimit(`password-reset:${email}`, 3, 15 * 60 * 1000))) redirect("/forgot-password?sent=1");
  const user = await db.user.findUnique({ where: { email } });
  let demoToken = "";
  if (user?.isActive) {
    const token = crypto.randomBytes(32).toString("base64url");
    demoToken = token;
    await db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000) } });
    if (emailConfigured()) await sendEmail({ to: user.email, subject: "Reset your Housing Packet Builder password", text: `Use this link within 30 minutes to reset your password: ${env.APP_URL}/reset-password?token=${encodeURIComponent(token)}\n\nIf you did not request this, no action is needed.` });
  }
  redirect(`/forgot-password?sent=1${!emailConfigured() && process.env.NODE_ENV !== "production" && demoToken ? `&demoToken=${encodeURIComponent(demoToken)}` : ""}`);
}

export async function resetPasswordAction(token: string, formData: FormData) {
  const reset = await db.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { include: { organization: true } } } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) redirect("/forgot-password?error=That+reset+link+is+invalid+or+has+expired.");
  const claimed = await db.passwordResetToken.updateMany({ where: { id: reset.id, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) redirect("/forgot-password?error=That+reset+link+is+invalid+or+has+expired.");
  const policy = reset.user.organization;
  let passwordSchema = z.string().min(policy?.passwordMinLength ?? 12).max(128).regex(/[a-z]/);
  if (policy?.passwordRequireUppercase ?? true) passwordSchema = passwordSchema.regex(/[A-Z]/);
  if (policy?.passwordRequireNumber ?? true) passwordSchema = passwordSchema.regex(/[0-9]/);
  const passwordResult = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!passwordResult.success) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=The+password+does+not+meet+your+organization%27s+security+policy.`);
  const password = passwordResult.data;
  if (password !== String(formData.get("confirmPassword") ?? "")) redirect(`/reset-password?token=${encodeURIComponent(token)}&error=Passwords+do+not+match.`);
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction([
    db.user.update({ where: { id: reset.userId }, data: { passwordHash, passwordChangedAt: new Date(), failedLoginCount: 0, lockedUntil: null } }),
    db.authSession.updateMany({ where: { userId: reset.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  redirect("/?error=Password+updated.+Sign+in+with+your+new+password.");
}

export async function verifyMfaAction(formData: FormData) {
  const store = await cookies(); const challengeToken = store.get(mfaCookie)?.value; if (!challengeToken) redirect("/?error=Your+verification+session+expired.+Sign+in+again.");
  const challenge = await db.mfaChallenge.findUnique({ where: { tokenHash: sha256(challengeToken) }, include: { user: true } }); if (!challenge || challenge.expiresAt <= new Date() || challenge.attempts >= 5 || !challenge.user.mfaEnabled || !challenge.user.mfaSecretEncrypted) redirect("/?error=Your+verification+session+expired.+Sign+in+again.");
  const code = z.string().trim().min(6).max(24).parse(formData.get("code")); const secret = decryptText(challenge.user.mfaSecretEncrypted); const result = await verify({ secret, token: code.replaceAll(" ", "") }); let valid = result.valid; let recoveryCodes = challenge.user.mfaRecoveryCodesEncrypted ? JSON.parse(decryptText(challenge.user.mfaRecoveryCodesEncrypted)) as string[] : [];
  let recoveryUsed = false;
  if (!valid) { const index = recoveryCodes.findIndex((item) => item === code.toUpperCase()); if (index >= 0) { valid = true; recoveryUsed = true; recoveryCodes = recoveryCodes.filter((_, itemIndex) => itemIndex !== index); } }
  if (!valid) { const failed = await db.mfaChallenge.updateMany({ where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { attempts: { increment: 1 } } }); if (failed.count !== 1) redirect("/?error=Your+verification+session+expired.+Sign+in+again."); redirect("/mfa?error=That+verification+code+was+not+accepted."); }
  if (recoveryUsed) {
    const consumed = await db.user.updateMany({ where: { id: challenge.userId, mfaRecoveryCodesEncrypted: challenge.user.mfaRecoveryCodesEncrypted }, data: { mfaRecoveryCodesEncrypted: encryptText(JSON.stringify(recoveryCodes)) } });
    if (consumed.count !== 1) redirect("/?error=That+recovery+code+was+already+used.");
  }
  const consumedChallenge = await db.mfaChallenge.deleteMany({ where: { id: challenge.id, attempts: { lt: 5 }, expiresAt: { gt: new Date() } } });
  if (consumedChallenge.count !== 1) redirect("/?error=Your+verification+session+expired.+Sign+in+again.");
  store.delete(mfaCookie); await createSession(challenge.userId); activateOrganizationContext(challenge.user); await recordAudit({ userId: challenge.userId, action: "LOGIN_MFA_SUCCEEDED", entityType: "User", entityId: challenge.userId, metadata: "Multi-factor authentication completed" }); redirect("/dashboard");
}

export async function beginMfaSetupAction() {
  const user = activateOrganizationContext(await getCurrentUser()); if (!user) redirect("/"); const secret = generateSecret(); const recoveryCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString("hex").toUpperCase()); await tenantDb.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: encryptText(secret), mfaRecoveryCodesEncrypted: encryptText(JSON.stringify(recoveryCodes)) } }); redirect("/account/security?setup=1");
}

export async function confirmMfaSetupAction(formData: FormData) {
  const user = activateOrganizationContext(await getCurrentUser()); if (!user) redirect("/"); const record = await tenantDb.user.findUniqueOrThrow({ where: { id: user.id } }); if (!record.mfaSecretEncrypted) redirect("/account/security?error=Start+MFA+setup+again."); const result = await verify({ secret: decryptText(record.mfaSecretEncrypted), token: z.string().trim().length(6).parse(formData.get("code")) }); if (!result.valid) redirect("/account/security?setup=1&error=That+code+was+not+accepted."); await tenantDb.user.update({ where: { id: user.id }, data: { mfaEnabled: true } }); await recordAudit({ userId: user.id, action: "MFA_ENABLED", entityType: "User", entityId: user.id, metadata: "TOTP multi-factor authentication enabled" }); redirect("/account/security?enabled=1");
}

export async function disableMfaAction(formData: FormData) {
  const user = activateOrganizationContext(await getCurrentUser()); if (!user) redirect("/"); const organization = await tenantDb.organization.findUniqueOrThrow({ where: { id: user.organizationId } }); if (organization.requireMfa) redirect("/account/security?error=Your+organization+requires+MFA.+Change+the+policy+before+disabling+it."); const record = await tenantDb.user.findUniqueOrThrow({ where: { id: user.id } }); if (!record.mfaSecretEncrypted) redirect("/account/security"); const result = await verify({ secret: decryptText(record.mfaSecretEncrypted), token: z.string().trim().length(6).parse(formData.get("code")) }); if (!result.valid) redirect("/account/security?error=That+code+was+not+accepted."); await tenantDb.$transaction([tenantDb.user.update({ where: { id: user.id }, data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaRecoveryCodesEncrypted: null } }), tenantDb.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } })]); await recordAudit({ userId: user.id, action: "MFA_DISABLED", entityType: "User", entityId: user.id, metadata: "TOTP multi-factor authentication disabled and sessions revoked" }); redirect("/");
}
