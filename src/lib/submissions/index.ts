import { db } from "@/lib/db";
import { generateApplicationOutput } from "@/lib/applications/output";
import { computeDraftContentDigest } from "@/lib/applications/integrity";
import { generateSupportingPacketPdf } from "@/lib/applications/pdf";
import { safeApplicationFilename } from "@/lib/applications/filename";
import { getLegacyOrStoredObject, putObject } from "@/lib/storage";
import { decryptText, sha256 } from "@/lib/security/encryption";
import { postPinnedJson } from "@/lib/security/safe-http";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

export async function deliverApplication(draftId: string, destinationId: string) {
  const { draft, pdfData, bytes: applicationBytes } = await generateApplicationOutput(draftId);
  if (draft.status !== "APPROVED" || !draft.approvedDigest) throw new Error("Only reviewer-approved applications can be delivered.");
  const currentDigest = await computeDraftContentDigest(draftId);
  if (draft.approvedDigest !== currentDigest) throw new Error("The application changed after approval and must be signed and reviewed again.");
  const destination = await db.submissionDestination.findFirstOrThrow({ where: { id: destinationId, housingProgramId: draft.template.housingProgramId, enabled: true } });
  const selected = draft.documents.filter((item) => item.selected && item.authorized && item.uploadedDocument.processingStatus === "COMPLETED" && item.uploadedDocument.quarantineStatus === "CLEAR" && !item.uploadedDocument.deletedAt && !item.uploadedDocument.extractedFields.some((field) => !["APPROVED", "EDITED"].includes(field.reviewStatus)));
  const documents = await Promise.all(selected.map(async (item) => ({ name: item.uploadedDocument.originalFilename, category: item.uploadedDocument.documentCategory, bytes: await getLegacyOrStoredObject(item.uploadedDocument) })));
  const selectedCategories = new Set(selected.map((item) => item.uploadedDocument.documentCategory));
  const missingDocuments = draft.clientCase.selectedProgram?.requirements.filter((item) => item.isRequired && !selectedCategories.has(item.category)).map((item) => item.name) ?? [];
  const packetBytes = await generateSupportingPacketPdf({ applicationBytes, applicationReference: pdfData.applicationReference, applicantName: draft.clientCase.legalName, documents, missingDocuments });
  const filename = safeApplicationFilename(draft.template.outputFilenamePattern, { clientName: draft.clientCase.legalName, version: draft.generationVersion });
  const requestDigest = sha256(Buffer.concat([Buffer.from(applicationBytes), Buffer.from(packetBytes)]));
  const idempotencyKey = sha256(`${draft.id}:${destinationId}:${draft.generationVersion}:${draft.approvedDigest}`);
  const existing = await db.applicationSubmission.findUnique({ where: { draftId_destinationId_generationVersion: { draftId, destinationId, generationVersion: draft.generationVersion } } });
  if (existing && ["ACCEPTED", "DELIVERED"].includes(existing.outcomeStatus)) return existing;
  if (existing?.canceledAt) throw new Error("This delivery was canceled and cannot be resumed.");
  let submission;
  if (existing) {
    const claimed = await db.applicationSubmission.updateMany({ where: { id: existing.id, canceledAt: null, status: { notIn: ["SUBMITTED", "CANCELED"] } }, data: { status: "PROCESSING", outcomeStatus: "UNKNOWN", requestDigest, idempotencyKey, attempts: { increment: 1 }, lastAttemptAt: new Date(), nextAttemptAt: null, errorMessage: null, deadLetteredAt: null } });
    if (claimed.count !== 1) throw new Error("This delivery was canceled or already completed.");
    submission = await db.applicationSubmission.findUniqueOrThrow({ where: { id: existing.id } });
  } else {
    submission = await db.applicationSubmission.create({ data: { draftId, destinationId, generationVersion: draft.generationVersion, status: "PROCESSING", outcomeStatus: "UNKNOWN", requestDigest, idempotencyKey, attempts: 1, lastAttemptAt: new Date() } });
  }
  try {
    const beforeSend = await db.applicationSubmission.findUnique({ where: { id: submission.id }, select: { canceledAt: true, status: true } });
    if (!beforeSend || beforeSend.canceledAt || beforeSend.status === "CANCELED") throw new Error("This delivery was canceled before transport.");
    let externalReference: string | undefined;
    let responseCode = 202;
    let responseSummary = "Transport accepted the submission";
    if (destination.type === "EMAIL") {
      if (!destination.recipient) throw new Error("Submission recipient is missing.");
      externalReference = await sendEmail({ to: destination.recipient, subject: `${draft.template.name} - ${draft.clientCase.referenceNumber}`, text: `Attached are the reviewer-approved application and supporting packet for reference ${draft.clientCase.referenceNumber}.`, messageId: `<${idempotencyKey}@housing-packet-builder>`, attachments: [{ filename, content: Buffer.from(applicationBytes), contentType: "application/pdf" }, { filename: filename.replace(/\.pdf$/i, "-supporting-packet.pdf"), content: Buffer.from(packetBytes), contentType: "application/pdf" }] });
      responseSummary = "Accepted by the configured SMTP transport; provider delivery is not independently confirmed";
    } else {
      if (!destination.endpoint) throw new Error("Submission endpoint is missing.");
      const config = destination.configEncrypted ? JSON.parse(decryptText(destination.configEncrypted)) as { authToken?: string } : {};
      const response = await postPinnedJson(destination.endpoint, { reference: draft.clientCase.referenceNumber, template: draft.template.name, templateVersion: draft.templateVersion, applicationFilename: filename, applicationPdfBase64: Buffer.from(applicationBytes).toString("base64"), supportingPacketPdfBase64: Buffer.from(packetBytes).toString("base64") }, { headers: { "idempotency-key": idempotencyKey, ...(config.authToken ? { authorization: `Bearer ${config.authToken}` } : {}) }, timeoutMs: env.SUBMISSION_TIMEOUT_MS });
      responseCode = response.status;
      if (response.status < 200 || response.status >= 300) throw new Error("The provider rejected the submission transport request.");
      externalReference = response.requestId;
      responseSummary = "Accepted by the configured provider transport; business acceptance must be confirmed from the provider receipt";
    }
    const receipt = await putObject(`delivery-receipts/${draft.id}/${submission.id}.json`, Buffer.from(JSON.stringify({ schema: "hapb-delivery-receipt/v1", submissionId: submission.id, idempotencyKey, requestDigest, responseCode, externalReference: externalReference ?? null, recordedAt: new Date().toISOString(), outcome: "ACCEPTED" })), "application/json");
    return db.applicationSubmission.update({ where: { id: submission.id }, data: { status: "SUBMITTED", outcomeStatus: "ACCEPTED", externalReference, responseCode, responseSummary, receiptStorageKey: receipt.key, submittedAt: new Date(), errorMessage: null } });
  } catch {
    await db.applicationSubmission.updateMany({ where: { id: submission.id, status: { not: "CANCELED" } }, data: { status: "FAILED", outcomeStatus: "UNKNOWN", errorMessage: "Delivery did not complete. The durable worker will retry according to policy." } });
    throw new Error("Delivery did not complete.");
  }
}
