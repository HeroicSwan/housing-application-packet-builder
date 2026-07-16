ALTER TABLE "Organization" ADD COLUMN "consentText" TEXT NOT NULL DEFAULT 'I consent to the approved supporting documents being shared for this application.';
ALTER TABLE "Organization" ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT 'document-release-v1';
ALTER TABLE "Organization" ADD COLUMN "signatureDisclaimer" TEXT NOT NULL DEFAULT 'Electronic signature acceptance depends on organization policy and applicable law.';
ALTER TABLE "Organization" ADD COLUMN "signaturePolicy" TEXT NOT NULL DEFAULT 'TYPED';

ALTER TABLE "UploadedDocument" ADD COLUMN "quarantineStatus" TEXT NOT NULL DEFAULT 'CLEAR';
ALTER TABLE "UploadedDocument" ADD COLUMN "quarantineReasonCode" TEXT;
ALTER TABLE "UploadedDocument" ADD COLUMN "duplicateOfId" TEXT;
ALTER TABLE "UploadedDocument" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "UploadedDocument" ADD COLUMN "deletedById" TEXT;
ALTER TABLE "UploadedDocument" ADD COLUMN "deletionReason" TEXT;
ALTER TABLE "UploadedDocument" ADD COLUMN "lastAccessedAt" DATETIME;
ALTER TABLE "UploadedDocument" ADD COLUMN "accessCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "UploadedDocument_clientCaseId_checksumSha256_idx" ON "UploadedDocument"("clientCaseId", "checksumSha256");
CREATE INDEX "UploadedDocument_clientCaseId_quarantineStatus_idx" ON "UploadedDocument"("clientCaseId", "quarantineStatus");

ALTER TABLE "ExtractedField" ADD COLUMN "normalizedValue" TEXT;
ALTER TABLE "ExtractedField" ADD COLUMN "reviewReason" TEXT;
ALTER TABLE "ExtractedField" ADD COLUMN "validationState" TEXT NOT NULL DEFAULT 'UNREVIEWED';
ALTER TABLE "ExtractedField" ADD COLUMN "sourceRegionJson" TEXT;
ALTER TABLE "ExtractedField" ADD COLUMN "modelOutputDigest" TEXT;
ALTER TABLE "ExtractedField" ADD COLUMN "reviewerRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ApplicationTemplate" ADD COLUMN "deprecatedAt" DATETIME;
ALTER TABLE "ApplicationTemplate" ADD COLUMN "deprecatedReason" TEXT;
ALTER TABLE "ApplicationTemplate" ADD COLUMN "compatibilityKey" TEXT;
ALTER TABLE "ApplicationTemplate" ADD COLUMN "rollbackFromTemplateId" TEXT;
ALTER TABLE "ApplicationTemplate" ADD COLUMN "migrationNotes" TEXT;

ALTER TABLE "ApplicationDraft" ADD COLUMN "contentDigest" TEXT;
ALTER TABLE "ApplicationDraft" ADD COLUMN "approvedDigest" TEXT;
ALTER TABLE "ApplicationDraft" ADD COLUMN "approvedAt" DATETIME;
ALTER TABLE "ApplicationDraft" ADD COLUMN "approvedById" TEXT;
ALTER TABLE "ApplicationDraft" ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ApplicationDraft" ADD COLUMN "approvalInvalidatedAt" DATETIME;
ALTER TABLE "ApplicationDraft" ADD COLUMN "approvalInvalidationReason" TEXT;

ALTER TABLE "ApplicationSignature" ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT 'document-release-v1';
ALTER TABLE "ApplicationSignature" ADD COLUMN "intentConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ApplicationSignature" ADD COLUMN "disclosureAccepted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ApplicationSignature" ADD COLUMN "signedContentDigest" TEXT;
ALTER TABLE "ApplicationSignature" ADD COLUMN "invalidatedAt" DATETIME;
ALTER TABLE "ApplicationSignature" ADD COLUMN "invalidationReason" TEXT;
ALTER TABLE "ApplicationSignature" ADD COLUMN "finalDocumentHash" TEXT;
ALTER TABLE "ApplicationSignature" ADD COLUMN "legalDisclaimerVersion" TEXT;

ALTER TABLE "ApplicationSubmission" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ApplicationSubmission" ADD COLUMN "outcomeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';
ALTER TABLE "ApplicationSubmission" ADD COLUMN "nextAttemptAt" DATETIME;
ALTER TABLE "ApplicationSubmission" ADD COLUMN "deadLetteredAt" DATETIME;
ALTER TABLE "ApplicationSubmission" ADD COLUMN "canceledAt" DATETIME;
ALTER TABLE "ApplicationSubmission" ADD COLUMN "receiptStorageKey" TEXT;
CREATE UNIQUE INDEX "ApplicationSubmission_idempotencyKey_key" ON "ApplicationSubmission"("idempotencyKey");

ALTER TABLE "DataLifecycleRequest" ADD COLUMN "exportExpiresAt" DATETIME;
ALTER TABLE "DataLifecycleRequest" ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DataLifecycleRequest" ADD COLUMN "maxDownloads" INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "DataLifecycleRequest" ADD COLUMN "lastDownloadedAt" DATETIME;
ALTER TABLE "DataLifecycleRequest" ADD COLUMN "accessFailureCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "DataLifecycleRequest" ADD COLUMN "cleanedUpAt" DATETIME;

ALTER TABLE "ApplicationPacket" ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ApplicationPacket" ADD COLUMN "assignedReviewerId" TEXT;
ALTER TABLE "ApplicationPacket" ADD COLUMN "escalatedAt" DATETIME;
ALTER TABLE "ApplicationPacket" ADD COLUMN "escalationReason" TEXT;
ALTER TABLE "ApplicationPacket" ADD COLUMN "approvalDigest" TEXT;
ALTER TABLE "ApplicationPacket" ADD COLUMN "approvedAt" DATETIME;

CREATE TABLE "SecureDownload" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" DATETIME NOT NULL,
  "maxDownloads" INTEGER NOT NULL DEFAULT 1,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "lastDownloadedAt" DATETIME,
  "revokedAt" DATETIME,
  "createdById" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecureDownload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SecureDownload_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SecureDownload_tokenHash_key" ON "SecureDownload"("tokenHash");
CREATE INDEX "SecureDownload_organizationId_resourceType_resourceId_idx" ON "SecureDownload"("organizationId", "resourceType", "resourceId");
CREATE INDEX "SecureDownload_expiresAt_revokedAt_idx" ON "SecureDownload"("expiresAt", "revokedAt");
