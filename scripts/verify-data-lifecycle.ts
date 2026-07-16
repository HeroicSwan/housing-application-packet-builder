import "dotenv/config";
import { gunzipSync } from "node:zlib";
import { db, systemDb } from "../src/lib/db";
import { runWithOrganization } from "../src/lib/tenant-context";
import { approveCaseDeletion, executeDueDeletions, exportCaseData, requestCaseDeletion } from "../src/lib/data-lifecycle";
import { getObject, putObject } from "../src/lib/storage";
import { enqueueBackgroundJob, runNextOrganizationJob } from "../src/lib/jobs";

async function main() {
  if (process.env.DATA_MODE !== "synthetic" || !process.env.DATABASE_URL?.includes("lifecycle-test-")) throw new Error("Lifecycle verification requires its disposable synthetic database.");
  const organization = await systemDb.organization.create({ data: { slug: "lifecycle-test", name: "Synthetic Lifecycle Test", deletionGraceDays: 1 } });
  const [requester, approver] = await Promise.all([
    systemDb.user.create({ data: { organizationId: organization.id, name: "Synthetic Requester", email: "requester@lifecycle.example.test", passwordHash: "not-used", role: "ADMIN" } }),
    systemDb.user.create({ data: { organizationId: organization.id, name: "Synthetic Approver", email: "approver@lifecycle.example.test", passwordHash: "not-used", role: "ADMIN" } }),
  ]);
  await runWithOrganization(organization.id, async () => {
    const clientCase = await db.clientCase.create({ data: { referenceNumber: "LIFECYCLE-001", legalName: "Synthetic Lifecycle Applicant", assignedCaseworkerId: requester.id } });
    const stored = await putObject(`documents/${clientCase.id}/synthetic.txt`, new TextEncoder().encode("synthetic document bytes"), "text/plain");
    const document = await db.uploadedDocument.create({ data: { clientCaseId: clientCase.id, originalFilename: "synthetic.pdf", safeFilename: "synthetic.pdf", fileType: "application/pdf", storageKey: stored.key, storageProvider: stored.provider, checksumSha256: stored.checksum, sizeBytes: stored.size, documentCategory: "OTHER", processingStatus: "PROCESSING", uploadedById: requester.id } });
    const job = await enqueueBackgroundJob("PROCESS_DOCUMENT", { documentId: document.id, userId: requester.id }, `document:${document.id}:acceptance`);
    await runNextOrganizationJob("synthetic-acceptance-worker");
    const [processedDocument, completedJob] = await Promise.all([db.uploadedDocument.findUniqueOrThrow({ where: { id: document.id } }), db.backgroundJob.findUniqueOrThrow({ where: { id: job.id } })]);
    if (processedDocument.processingStatus !== "COMPLETED" || completedJob.status !== "COMPLETED") throw new Error("Durable document job verification failed.");
    const exportRequest = await exportCaseData(clientCase.id, requester.id);
    const exported = JSON.parse(gunzipSync(await getObject(exportRequest.exportStorageKey!)).toString()) as { schema: string; clientCase: { id: string }; documents: unknown[] };
    if (exported.schema !== "housing-application-case-export/v1" || exported.clientCase.id !== clientCase.id || exported.documents.length !== 1) throw new Error("Case export verification failed.");
    const deletion = await requestCaseDeletion(clientCase.id, requester.id, "Synthetic lifecycle acceptance test");
    await approveCaseDeletion(deletion.id, approver.id);
    await db.dataLifecycleRequest.update({ where: { id: deletion.id }, data: { executeAfter: new Date(0) } });
    if (await executeDueDeletions() !== 1) throw new Error("Due deletion did not execute.");
    const [remainingCase, completedRequest, completionAudit] = await Promise.all([
      systemDb.clientCase.count({ where: { id: clientCase.id } }),
      systemDb.dataLifecycleRequest.findUniqueOrThrow({ where: { id: deletion.id } }),
      systemDb.auditEvent.count({ where: { entityId: clientCase.id, action: "CASE_DELETION_COMPLETED" } }),
    ]);
    if (remainingCase !== 0 || completedRequest.status !== "COMPLETED" || completionAudit !== 1) throw new Error("Deletion evidence verification failed.");
    console.log(JSON.stringify({ durableJobVerified: true, exportVerified: true, encryptedObjectVerified: true, caseDeleted: true, deletionEvidence: true }));
  });
  await systemDb.$disconnect();
}

main().catch(async (error) => { console.error(error); await systemDb.$disconnect(); process.exitCode = 1; });
