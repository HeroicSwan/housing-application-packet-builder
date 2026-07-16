import "dotenv/config";
import { db, systemDb } from "../src/lib/db";
import { runWithOrganization } from "../src/lib/tenant-context";
import { decryptText, encryptText } from "../src/lib/security/encryption";
import { getObject, putObject } from "../src/lib/storage";
import { env } from "../src/lib/env";

async function main() {
  if (!env.DATA_ENCRYPTION_PREVIOUS_KEYS) throw new Error("Set DATA_ENCRYPTION_PREVIOUS_KEYS to the old key ring before rotating data.");
  const organizations = await systemDb.organization.findMany({ select: { id: true } });
  let databaseValues = 0;
  let objects = 0;
  for (const organization of organizations) await runWithOrganization(organization.id, async () => {
    const users = await db.user.findMany({ where: { OR: [{ mfaSecretEncrypted: { not: null } }, { mfaRecoveryCodesEncrypted: { not: null } }] } });
    for (const user of users) {
      await db.user.update({ where: { id: user.id }, data: { mfaSecretEncrypted: user.mfaSecretEncrypted ? encryptText(decryptText(user.mfaSecretEncrypted)) : null, mfaRecoveryCodesEncrypted: user.mfaRecoveryCodesEncrypted ? encryptText(decryptText(user.mfaRecoveryCodesEncrypted)) : null } });
      databaseValues += Number(Boolean(user.mfaSecretEncrypted)) + Number(Boolean(user.mfaRecoveryCodesEncrypted));
    }
    const destinations = await db.submissionDestination.findMany({ where: { configEncrypted: { not: null } } });
    for (const destination of destinations) {
      await db.submissionDestination.update({ where: { id: destination.id }, data: { configEncrypted: encryptText(decryptText(destination.configEncrypted!)) } });
      databaseValues += 1;
    }
    const jobs = await db.backgroundJob.findMany({ where: { status: { in: ["PENDING", "PROCESSING"] } } });
    for (const job of jobs) {
      await db.backgroundJob.update({ where: { id: job.id }, data: { payloadEncrypted: encryptText(decryptText(job.payloadEncrypted)) } });
      databaseValues += 1;
    }
    const [documents, templates, exports] = await Promise.all([
      db.uploadedDocument.findMany({ where: { storageKey: { not: null } }, select: { storageKey: true, fileType: true } }),
      db.applicationTemplate.findMany({ where: { sourceStorageKey: { not: null } }, select: { sourceStorageKey: true } }),
      db.dataLifecycleRequest.findMany({ where: { exportStorageKey: { not: null } }, select: { exportStorageKey: true } }),
    ]);
    const keys = new Map<string, string>();
    for (const item of documents) keys.set(item.storageKey!, item.fileType);
    for (const item of templates) keys.set(item.sourceStorageKey!, "application/pdf");
    for (const item of exports) keys.set(item.exportStorageKey!, "application/gzip");
    for (const [key, contentType] of keys) {
      const plaintext = await getObject(key);
      await putObject(key, plaintext, contentType);
      objects += 1;
    }
  });
  console.log(JSON.stringify({ event: "encryption_rotation_completed", keyId: env.DATA_ENCRYPTION_KEY_ID, databaseValues, objects, at: new Date().toISOString() }));
  await systemDb.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await systemDb.$disconnect();
  process.exitCode = 1;
});
