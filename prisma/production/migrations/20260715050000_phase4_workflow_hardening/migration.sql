ALTER TABLE "Organization"
  ADD COLUMN "consentText" TEXT NOT NULL DEFAULT 'I consent to the approved supporting documents being shared for this application.',
  ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT 'document-release-v1',
  ADD COLUMN "signatureDisclaimer" TEXT NOT NULL DEFAULT 'Electronic signature acceptance depends on organization policy and applicable law.',
  ADD COLUMN "signaturePolicy" TEXT NOT NULL DEFAULT 'TYPED';

ALTER TABLE "UploadedDocument"
  ADD COLUMN "quarantineStatus" TEXT NOT NULL DEFAULT 'CLEAR',
  ADD COLUMN "quarantineReasonCode" TEXT,
  ADD COLUMN "duplicateOfId" TEXT,
  ADD COLUMN "deletedAt" TIMESTAMP(3),
  ADD COLUMN "deletedById" TEXT,
  ADD COLUMN "deletionReason" TEXT,
  ADD COLUMN "lastAccessedAt" TIMESTAMP(3),
  ADD COLUMN "accessCount" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "UploadedDocument_clientCaseId_checksumSha256_idx" ON "UploadedDocument"("clientCaseId", "checksumSha256");
CREATE INDEX "UploadedDocument_clientCaseId_quarantineStatus_idx" ON "UploadedDocument"("clientCaseId", "quarantineStatus");

ALTER TABLE "ExtractedField"
  ADD COLUMN "normalizedValue" TEXT,
  ADD COLUMN "reviewReason" TEXT,
  ADD COLUMN "validationState" TEXT NOT NULL DEFAULT 'UNREVIEWED',
  ADD COLUMN "sourceRegionJson" TEXT,
  ADD COLUMN "modelOutputDigest" TEXT,
  ADD COLUMN "reviewerRevision" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ApplicationTemplate"
  ADD COLUMN "deprecatedAt" TIMESTAMP(3),
  ADD COLUMN "deprecatedReason" TEXT,
  ADD COLUMN "compatibilityKey" TEXT,
  ADD COLUMN "rollbackFromTemplateId" TEXT,
  ADD COLUMN "migrationNotes" TEXT;

ALTER TABLE "ApplicationDraft"
  ADD COLUMN "contentDigest" TEXT,
  ADD COLUMN "approvedDigest" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "approvalInvalidatedAt" TIMESTAMP(3),
  ADD COLUMN "approvalInvalidationReason" TEXT;

ALTER TABLE "ApplicationSignature"
  ADD COLUMN "consentVersion" TEXT NOT NULL DEFAULT 'document-release-v1',
  ADD COLUMN "intentConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "disclosureAccepted" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "signedContentDigest" TEXT,
  ADD COLUMN "invalidatedAt" TIMESTAMP(3),
  ADD COLUMN "invalidationReason" TEXT,
  ADD COLUMN "finalDocumentHash" TEXT,
  ADD COLUMN "legalDisclaimerVersion" TEXT;

ALTER TABLE "ApplicationSubmission"
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "outcomeStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "deadLetteredAt" TIMESTAMP(3),
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "receiptStorageKey" TEXT;
CREATE UNIQUE INDEX "ApplicationSubmission_idempotencyKey_key" ON "ApplicationSubmission"("idempotencyKey");

ALTER TABLE "DataLifecycleRequest"
  ADD COLUMN "exportExpiresAt" TIMESTAMP(3),
  ADD COLUMN "downloadCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxDownloads" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "lastDownloadedAt" TIMESTAMP(3),
  ADD COLUMN "accessFailureCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "cleanedUpAt" TIMESTAMP(3);

ALTER TABLE "ApplicationPacket"
  ADD COLUMN "reviewCycle" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "assignedReviewerId" TEXT,
  ADD COLUMN "escalatedAt" TIMESTAMP(3),
  ADD COLUMN "escalationReason" TEXT,
  ADD COLUMN "approvalDigest" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

CREATE TABLE "SecureDownload" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "maxDownloads" INTEGER NOT NULL DEFAULT 1,
  "downloadCount" INTEGER NOT NULL DEFAULT 0,
  "lastDownloadedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecureDownload_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SecureDownload_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SecureDownload_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SecureDownload_tokenHash_key" ON "SecureDownload"("tokenHash");
CREATE INDEX "SecureDownload_organizationId_resourceType_resourceId_idx" ON "SecureDownload"("organizationId", "resourceType", "resourceId");
CREATE INDEX "SecureDownload_expiresAt_revokedAt_idx" ON "SecureDownload"("expiresAt", "revokedAt");

ALTER TABLE "SecureDownload" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SecureDownload" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SecureDownload"
  USING ("organizationId" = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK ("organizationId" = nullif(current_setting('app.organization_id', true), ''));
