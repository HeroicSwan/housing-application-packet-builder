-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" DATETIME,
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "mfaRecoveryCodesEncrypted" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "ipHash" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "count" INTEGER NOT NULL,
    "resetAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ClientCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceNumber" TEXT NOT NULL,
    "assignedCaseworkerId" TEXT NOT NULL,
    "selectedProgramId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "preferredName" TEXT,
    "legalName" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "preferredLanguage" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "currentLivingSituation" TEXT,
    "accessibilityNeeds" TEXT,
    "mailingAddress" TEXT,
    "previousAddress" TEXT,
    "emergencyContact" TEXT,
    "veteranStatus" TEXT,
    "benefitPrograms" TEXT,
    "monthlyEarnedIncomeCents" INTEGER,
    "monthlyBenefitsIncomeCents" INTEGER,
    "otherIncomeCents" INTEGER,
    "consentConfirmedAt" DATETIME,
    "desiredMoveInDate" DATETIME,
    "transportationNeeds" TEXT,
    "evictionHistory" TEXT,
    "rentalArrearsCents" INTEGER,
    "contactPermission" BOOLEAN,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ClientCase_assignedCaseworkerId_fkey" FOREIGN KEY ("assignedCaseworkerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientCase_selectedProgramId_fkey" FOREIGN KEY ("selectedProgramId") REFERENCES "HousingProgram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "monthlyIncomeCents" INTEGER,
    "incomeSource" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HouseholdMember_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCaseId" TEXT NOT NULL,
    "householdMemberId" TEXT,
    "earnerName" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "incomeType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "hoursPerWeek" REAL,
    "weeksPerYear" REAL,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "isGross" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IncomeRecord_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "IncomeRecord_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "HouseholdMember" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HousingProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicationDeadline" DATETIME,
    "incomeLimitNotes" TEXT,
    "householdRestrictions" TEXT,
    "accessibilityNotes" TEXT,
    "contactInformation" TEXT,
    "fictional" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProgramRequirement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "housingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT NOT NULL,
    "validationRules" TEXT,
    "expirationPeriodDays" INTEGER,
    "applicableHouseholdRules" TEXT,
    "requiredFieldName" TEXT,
    "clientField" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProgramRequirement_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCaseId" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "safeFilename" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "storagePath" TEXT,
    "storageKey" TEXT,
    "storageProvider" TEXT NOT NULL DEFAULT 'LOCAL',
    "encryptedAtRest" BOOLEAN NOT NULL DEFAULT true,
    "checksumSha256" TEXT,
    "sizeBytes" INTEGER,
    "documentCategory" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" DATETIME,
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "uploadedById" TEXT NOT NULL,
    CONSTRAINT "UploadedDocument_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UploadedDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "housingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "templateType" TEXT NOT NULL DEFAULT 'GENERATED_PDF',
    "sourceFilePath" TEXT,
    "sourceStorageKey" TEXT,
    "outputFilenamePattern" TEXT NOT NULL,
    "publishedAt" DATETIME,
    "supersedesTemplateId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationTemplate_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationTemplate_supersedesTemplateId_fkey" FOREIGN KEY ("supersedesTemplateId") REFERENCES "ApplicationTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationTemplateField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "displayLabel" TEXT NOT NULL,
    "fieldType" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "canonicalFieldPath" TEXT,
    "pageNumber" INTEGER NOT NULL,
    "section" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "validationRules" TEXT,
    "conditionalRules" TEXT,
    "formattingRules" TEXT,
    "pdfFieldName" TEXT,
    "positionInformation" TEXT,
    "staffGuidance" TEXT,
    "optionsJson" TEXT,
    CONSTRAINT "ApplicationTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApplicationTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCaseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "generatedAt" DATETIME,
    "generationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "ApplicationDraft_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApplicationTemplate" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApplicationDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationSignature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signatureMethod" TEXT NOT NULL DEFAULT 'TYPED',
    "attestationVersion" TEXT NOT NULL,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT NOT NULL,
    "signerIpHash" TEXT,
    CONSTRAINT "ApplicationSignature_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationSignature_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clientCaseId" TEXT NOT NULL,
    "draftId" TEXT,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "recordedById" TEXT NOT NULL,
    "evidenceNote" TEXT,
    CONSTRAINT "ConsentRecord_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConsentRecord_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ConsentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubmissionDestination" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "housingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT,
    "recipient" TEXT,
    "configEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubmissionDestination_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "generationVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalReference" TEXT,
    "requestDigest" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" DATETIME,
    "submittedAt" DATETIME,
    "responseCode" INTEGER,
    "responseSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationSubmission_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationSubmission_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "SubmissionDestination" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT,
    "checksum" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT
);

-- CreateTable
CREATE TABLE "ApplicationDraftField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "templateFieldId" TEXT NOT NULL,
    "proposedValue" TEXT,
    "finalValue" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "populationMethod" TEXT NOT NULL,
    "reviewState" TEXT NOT NULL DEFAULT 'PENDING',
    "validationState" TEXT NOT NULL DEFAULT 'VALID',
    "staffNote" TEXT,
    "answeredById" TEXT,
    "answeredAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApplicationDraftField_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationDraftField_templateFieldId_fkey" FOREIGN KEY ("templateFieldId") REFERENCES "ApplicationTemplateField" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApplicationDraftField_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationDraftDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "draftId" TEXT NOT NULL,
    "uploadedDocumentId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "authorized" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ApplicationDraftDocument_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationDraftDocument_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "uploadedDocumentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "sourcePage" INTEGER,
    "sourceText" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedValue" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" DATETIME,
    CONSTRAINT "ExtractedField_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExtractedField_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ApplicationPacket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "referenceNumber" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "housingProgramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" DATETIME,
    "approvedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "unresolvedConflicts" INTEGER NOT NULL DEFAULT 0,
    "snapshotJson" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "ApplicationPacket_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ApplicationPacket_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ApplicationPacket_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PacketField" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packetId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "fieldLabel" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerNote" TEXT,
    "reviewerId" TEXT,
    CONSTRAINT "PacketField_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PacketField_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewNote_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RequirementOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "packetId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RequirementOverride_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RequirementOverride_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clientCaseId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "MfaChallenge_userId_expiresAt_idx" ON "MfaChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCase_referenceNumber_key" ON "ClientCase"("referenceNumber");

-- CreateIndex
CREATE INDEX "ClientCase_assignedCaseworkerId_status_idx" ON "ClientCase"("assignedCaseworkerId", "status");

-- CreateIndex
CREATE INDEX "HouseholdMember_clientCaseId_idx" ON "HouseholdMember"("clientCaseId");

-- CreateIndex
CREATE INDEX "IncomeRecord_clientCaseId_endDate_idx" ON "IncomeRecord"("clientCaseId", "endDate");

-- CreateIndex
CREATE INDEX "IncomeRecord_householdMemberId_idx" ON "IncomeRecord"("householdMemberId");

-- CreateIndex
CREATE INDEX "ProgramRequirement_housingProgramId_sortOrder_idx" ON "ProgramRequirement"("housingProgramId", "sortOrder");

-- CreateIndex
CREATE INDEX "UploadedDocument_clientCaseId_documentCategory_idx" ON "UploadedDocument"("clientCaseId", "documentCategory");

-- CreateIndex
CREATE INDEX "UploadedDocument_uploadedById_uploadedAt_idx" ON "UploadedDocument"("uploadedById", "uploadedAt");

-- CreateIndex
CREATE INDEX "ApplicationTemplate_housingProgramId_status_idx" ON "ApplicationTemplate"("housingProgramId", "status");

-- CreateIndex
CREATE INDEX "ApplicationTemplate_supersedesTemplateId_idx" ON "ApplicationTemplate"("supersedesTemplateId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationTemplate_housingProgramId_name_version_key" ON "ApplicationTemplate"("housingProgramId", "name", "version");

-- CreateIndex
CREATE INDEX "ApplicationTemplateField_templateId_displayOrder_idx" ON "ApplicationTemplateField"("templateId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationTemplateField_templateId_fieldKey_key" ON "ApplicationTemplateField"("templateId", "fieldKey");

-- CreateIndex
CREATE INDEX "ApplicationDraft_status_updatedAt_idx" ON "ApplicationDraft"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDraft_clientCaseId_templateId_key" ON "ApplicationDraft"("clientCaseId", "templateId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSignature_draftId_key" ON "ApplicationSignature"("draftId");

-- CreateIndex
CREATE INDEX "ConsentRecord_clientCaseId_consentType_grantedAt_idx" ON "ConsentRecord"("clientCaseId", "consentType", "grantedAt");

-- CreateIndex
CREATE INDEX "ConsentRecord_draftId_idx" ON "ConsentRecord"("draftId");

-- CreateIndex
CREATE INDEX "SubmissionDestination_housingProgramId_enabled_idx" ON "SubmissionDestination"("housingProgramId", "enabled");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_draftId_status_idx" ON "ApplicationSubmission"("draftId", "status");

-- CreateIndex
CREATE INDEX "ApplicationSubmission_destinationId_createdAt_idx" ON "ApplicationSubmission"("destinationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationSubmission_draftId_destinationId_generationVersion_key" ON "ApplicationSubmission"("draftId", "destinationId", "generationVersion");

-- CreateIndex
CREATE INDEX "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");

-- CreateIndex
CREATE INDEX "ApplicationDraftField_draftId_reviewState_validationState_idx" ON "ApplicationDraftField"("draftId", "reviewState", "validationState");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDraftField_draftId_templateFieldId_key" ON "ApplicationDraftField"("draftId", "templateFieldId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDraftDocument_draftId_uploadedDocumentId_key" ON "ApplicationDraftDocument"("draftId", "uploadedDocumentId");

-- CreateIndex
CREATE INDEX "ExtractedField_uploadedDocumentId_reviewStatus_idx" ON "ExtractedField"("uploadedDocumentId", "reviewStatus");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPacket_referenceNumber_key" ON "ApplicationPacket"("referenceNumber");

-- CreateIndex
CREATE INDEX "ApplicationPacket_status_generatedAt_idx" ON "ApplicationPacket"("status", "generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationPacket_clientCaseId_version_key" ON "ApplicationPacket"("clientCaseId", "version");

-- CreateIndex
CREATE INDEX "ReviewNote_packetId_createdAt_idx" ON "ReviewNote"("packetId", "createdAt");

-- CreateIndex
CREATE INDEX "RequirementOverride_packetId_createdAt_idx" ON "RequirementOverride"("packetId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RequirementOverride_packetId_requirementId_key" ON "RequirementOverride"("packetId", "requirementId");

-- CreateIndex
CREATE INDEX "AuditEvent_clientCaseId_createdAt_idx" ON "AuditEvent"("clientCaseId", "createdAt");
