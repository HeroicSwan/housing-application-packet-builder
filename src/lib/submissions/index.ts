import { db } from "@/lib/db";
import { generateApplicationOutput } from "@/lib/applications/output";
import { generateSupportingPacketPdf } from "@/lib/applications/pdf";
import { safeApplicationFilename } from "@/lib/applications/filename";
import { getLegacyOrStoredObject } from "@/lib/storage";
import { decryptText, sha256 } from "@/lib/security/encryption";
import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";

function validateDestinationUrl(endpoint: string) {
  const url = new URL(endpoint);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production submission endpoints must use HTTPS.");
  if (process.env.NODE_ENV === "production" && /^(localhost|127\.|10\.|192\.168\.|169\.254\.|::1$)/.test(url.hostname)) throw new Error("Private network submission endpoints are not allowed.");
  return url;
}

export async function deliverApplication(draftId: string, destinationId: string) {
  const { draft, pdfData, bytes: applicationBytes } = await generateApplicationOutput(draftId);
  if (draft.status !== "APPROVED") throw new Error("Only reviewer-approved applications can be delivered.");
  const destination = await db.submissionDestination.findFirstOrThrow({ where: { id: destinationId, housingProgramId: draft.template.housingProgramId, enabled: true } });
  const selected = draft.documents.filter((item) => item.selected && item.authorized && item.uploadedDocument.processingStatus === "COMPLETED" && !item.uploadedDocument.extractedFields.some((field) => field.reviewStatus === "REJECTED"));
  const documents = await Promise.all(selected.map(async (item) => ({ name: item.uploadedDocument.originalFilename, category: item.uploadedDocument.documentCategory, bytes: await getLegacyOrStoredObject(item.uploadedDocument) })));
  const selectedCategories = new Set(selected.map((item) => item.uploadedDocument.documentCategory));
  const missingDocuments = draft.clientCase.selectedProgram?.requirements.filter((item) => item.isRequired && !selectedCategories.has(item.category)).map((item) => item.name) ?? [];
  const packetBytes = await generateSupportingPacketPdf({ applicationBytes, applicationReference: pdfData.applicationReference, applicantName: draft.clientCase.legalName, documents, missingDocuments });
  const filename = safeApplicationFilename(draft.template.outputFilenamePattern, { clientName: draft.clientCase.legalName, version: draft.generationVersion });
  const requestDigest = sha256(Buffer.concat([Buffer.from(applicationBytes), Buffer.from(packetBytes)]));
  const submission = await db.applicationSubmission.upsert({ where: { draftId_destinationId_generationVersion: { draftId, destinationId, generationVersion: draft.generationVersion } }, create: { draftId, destinationId, generationVersion: draft.generationVersion, status: "PROCESSING", requestDigest, attempts: 1, lastAttemptAt: new Date() }, update: { status: "PROCESSING", requestDigest, attempts: { increment: 1 }, lastAttemptAt: new Date(), errorMessage: null } });
  try {
    let externalReference: string | undefined; let responseCode = 200; let responseSummary = "Delivered";
    if (destination.type === "EMAIL") {
      if (!destination.recipient) throw new Error("Submission recipient is missing.");
      externalReference = await sendEmail({ to: destination.recipient, subject: `${draft.template.name} - ${draft.clientCase.referenceNumber}`, text: `Attached are the reviewer-approved application and supporting packet for reference ${draft.clientCase.referenceNumber}.`, attachments: [{ filename, content: Buffer.from(applicationBytes), contentType: "application/pdf" }, { filename: filename.replace(/\.pdf$/i, "-supporting-packet.pdf"), content: Buffer.from(packetBytes), contentType: "application/pdf" }] });
      responseSummary = "Accepted by SMTP server";
    } else {
      if (!destination.endpoint) throw new Error("Submission endpoint is missing.");
      const url = validateDestinationUrl(destination.endpoint); const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), env.SUBMISSION_TIMEOUT_MS);
      const config = destination.configEncrypted ? JSON.parse(decryptText(destination.configEncrypted)) as { authToken?: string } : {};
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": `${draft.id}:${draft.generationVersion}`, ...(config.authToken ? { Authorization: `Bearer ${config.authToken}` } : {}) }, body: JSON.stringify({ reference: draft.clientCase.referenceNumber, template: draft.template.name, templateVersion: draft.templateVersion, applicationFilename: filename, applicationPdfBase64: Buffer.from(applicationBytes).toString("base64"), supportingPacketPdfBase64: Buffer.from(packetBytes).toString("base64") }), signal: controller.signal }); clearTimeout(timeout); responseCode = response.status;
      const responseBody = (await response.text()).slice(0, 1000); if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}.`);
      try { const parsed = JSON.parse(responseBody) as { id?: string; reference?: string; message?: string }; externalReference = parsed.id ?? parsed.reference; responseSummary = parsed.message?.slice(0, 300) ?? "Accepted by provider API"; } catch { responseSummary = responseBody || "Accepted by provider API"; }
    }
    return db.applicationSubmission.update({ where: { id: submission.id }, data: { status: "SUBMITTED", externalReference, responseCode, responseSummary, submittedAt: new Date() } });
  } catch (error) {
    await db.applicationSubmission.update({ where: { id: submission.id }, data: { status: "FAILED", errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Delivery failed" } });
    throw error;
  }
}
