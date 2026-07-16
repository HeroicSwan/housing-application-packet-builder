-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "mfaRecoveryCodesEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MfaChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MfaChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ipHash" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "resetAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ClientCase" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "assignedCaseworkerId" TEXT NOT NULL,
    "selectedProgramId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'INTAKE',
    "preferredName" TEXT,
    "legalName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
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
    "consentConfirmedAt" TIMESTAMP(3),
    "desiredMoveInDate" TIMESTAMP(3),
    "transportationNeeds" TEXT,
    "evictionHistory" TEXT,
    "rentalArrearsCents" INTEGER,
    "contactPermission" BOOLEAN,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseholdMember" (
    "id" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "monthlyIncomeCents" INTEGER,
    "incomeSource" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HouseholdMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IncomeRecord" (
    "id" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "householdMemberId" TEXT,
    "earnerName" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "incomeType" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "frequency" TEXT NOT NULL,
    "hoursPerWeek" DOUBLE PRECISION,
    "weeksPerYear" DOUBLE PRECISION,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isGross" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IncomeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HousingProgram" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "applicationDeadline" TIMESTAMP(3),
    "incomeLimitNotes" TEXT,
    "householdRestrictions" TEXT,
    "accessibilityNotes" TEXT,
    "contactInformation" TEXT,
    "fictional" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramRequirement" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "ProgramRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadedDocument" (
    "id" TEXT NOT NULL,
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
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expirationDate" TIMESTAMP(3),
    "processingStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "processingError" TEXT,
    "uploadedById" TEXT NOT NULL,

    CONSTRAINT "UploadedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTemplate" (
    "id" TEXT NOT NULL,
    "housingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "templateType" TEXT NOT NULL DEFAULT 'GENERATED_PDF',
    "sourceFilePath" TEXT,
    "sourceStorageKey" TEXT,
    "outputFilenamePattern" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "supersedesTemplateId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationTemplateField" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "ApplicationTemplateField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDraft" (
    "id" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "generatedAt" TIMESTAMP(3),
    "generationVersion" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,

    CONSTRAINT "ApplicationDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSignature" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "signedName" TEXT NOT NULL,
    "signerEmail" TEXT,
    "signatureMethod" TEXT NOT NULL DEFAULT 'TYPED',
    "attestationVersion" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "capturedById" TEXT NOT NULL,
    "signerIpHash" TEXT,

    CONSTRAINT "ApplicationSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "draftId" TEXT,
    "consentType" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "recordedById" TEXT NOT NULL,
    "evidenceNote" TEXT,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionDestination" (
    "id" TEXT NOT NULL,
    "housingProgramId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "endpoint" TEXT,
    "recipient" TEXT,
    "configEncrypted" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubmissionDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationSubmission" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "generationVersion" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "externalReference" TEXT,
    "requestDigest" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "responseCode" INTEGER,
    "responseSummary" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BackupRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT,
    "checksum" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDraftField" (
    "id" TEXT NOT NULL,
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
    "answeredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationDraftField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationDraftDocument" (
    "id" TEXT NOT NULL,
    "draftId" TEXT NOT NULL,
    "uploadedDocumentId" TEXT NOT NULL,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "authorized" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ApplicationDraftDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExtractedField" (
    "id" TEXT NOT NULL,
    "uploadedDocumentId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "extractedValue" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "sourcePage" INTEGER,
    "sourceText" TEXT,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedValue" TEXT,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ExtractedField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationPacket" (
    "id" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "clientCaseId" TEXT NOT NULL,
    "housingProgramId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "unresolvedConflicts" INTEGER NOT NULL DEFAULT 0,
    "snapshotJson" TEXT NOT NULL DEFAULT '{}',

    CONSTRAINT "ApplicationPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketField" (
    "id" TEXT NOT NULL,
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

    CONSTRAINT "PacketField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReviewNote" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementOverride" (
    "id" TEXT NOT NULL,
    "packetId" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "requirementName" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RequirementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientCaseId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_organizationId_role_isActive_idx" ON "User"("organizationId", "role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "MfaChallenge_tokenHash_key" ON "MfaChallenge"("tokenHash");

-- CreateIndex
CREATE INDEX "MfaChallenge_userId_expiresAt_idx" ON "MfaChallenge"("userId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_organizationId_expiresAt_idx" ON "AuthSession"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_expiresAt_idx" ON "PasswordResetToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "ClientCase_assignedCaseworkerId_status_idx" ON "ClientCase"("assignedCaseworkerId", "status");

-- CreateIndex
CREATE INDEX "ClientCase_organizationId_status_idx" ON "ClientCase"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClientCase_organizationId_referenceNumber_key" ON "ClientCase"("organizationId", "referenceNumber");

-- CreateIndex
CREATE INDEX "HouseholdMember_clientCaseId_idx" ON "HouseholdMember"("clientCaseId");

-- CreateIndex
CREATE INDEX "IncomeRecord_clientCaseId_endDate_idx" ON "IncomeRecord"("clientCaseId", "endDate");

-- CreateIndex
CREATE INDEX "IncomeRecord_householdMemberId_idx" ON "IncomeRecord"("householdMemberId");

-- CreateIndex
CREATE INDEX "HousingProgram_organizationId_isActive_idx" ON "HousingProgram"("organizationId", "isActive");

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
CREATE UNIQUE INDEX "ApplicationSubmission_draftId_destinationId_generationVersi_key" ON "ApplicationSubmission"("draftId", "destinationId", "generationVersion");

-- CreateIndex
CREATE INDEX "BackupRun_organizationId_startedAt_idx" ON "BackupRun"("organizationId", "startedAt");

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
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_clientCaseId_createdAt_idx" ON "AuditEvent"("clientCaseId", "createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MfaChallenge" ADD CONSTRAINT "MfaChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCase" ADD CONSTRAINT "ClientCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCase" ADD CONSTRAINT "ClientCase_assignedCaseworkerId_fkey" FOREIGN KEY ("assignedCaseworkerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientCase" ADD CONSTRAINT "ClientCase_selectedProgramId_fkey" FOREIGN KEY ("selectedProgramId") REFERENCES "HousingProgram"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseholdMember" ADD CONSTRAINT "HouseholdMember_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IncomeRecord" ADD CONSTRAINT "IncomeRecord_householdMemberId_fkey" FOREIGN KEY ("householdMemberId") REFERENCES "HouseholdMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HousingProgram" ADD CONSTRAINT "HousingProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramRequirement" ADD CONSTRAINT "ProgramRequirement_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedDocument" ADD CONSTRAINT "UploadedDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTemplate" ADD CONSTRAINT "ApplicationTemplate_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTemplate" ADD CONSTRAINT "ApplicationTemplate_supersedesTemplateId_fkey" FOREIGN KEY ("supersedesTemplateId") REFERENCES "ApplicationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationTemplateField" ADD CONSTRAINT "ApplicationTemplateField_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApplicationTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApplicationTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraft" ADD CONSTRAINT "ApplicationDraft_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSignature" ADD CONSTRAINT "ApplicationSignature_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSignature" ADD CONSTRAINT "ApplicationSignature_capturedById_fkey" FOREIGN KEY ("capturedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionDestination" ADD CONSTRAINT "SubmissionDestination_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationSubmission" ADD CONSTRAINT "ApplicationSubmission_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "SubmissionDestination"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BackupRun" ADD CONSTRAINT "BackupRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraftField" ADD CONSTRAINT "ApplicationDraftField_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraftField" ADD CONSTRAINT "ApplicationDraftField_templateFieldId_fkey" FOREIGN KEY ("templateFieldId") REFERENCES "ApplicationTemplateField"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraftField" ADD CONSTRAINT "ApplicationDraftField_answeredById_fkey" FOREIGN KEY ("answeredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraftDocument" ADD CONSTRAINT "ApplicationDraftDocument_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "ApplicationDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationDraftDocument" ADD CONSTRAINT "ApplicationDraftDocument_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_uploadedDocumentId_fkey" FOREIGN KEY ("uploadedDocumentId") REFERENCES "UploadedDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtractedField" ADD CONSTRAINT "ExtractedField_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPacket" ADD CONSTRAINT "ApplicationPacket_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPacket" ADD CONSTRAINT "ApplicationPacket_housingProgramId_fkey" FOREIGN KEY ("housingProgramId") REFERENCES "HousingProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationPacket" ADD CONSTRAINT "ApplicationPacket_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketField" ADD CONSTRAINT "PacketField_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketField" ADD CONSTRAINT "PacketField_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewNote" ADD CONSTRAINT "ReviewNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOverride" ADD CONSTRAINT "RequirementOverride_packetId_fkey" FOREIGN KEY ("packetId") REFERENCES "ApplicationPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementOverride" ADD CONSTRAINT "RequirementOverride_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tenant identity is transaction-local and is set by the application Prisma extension.
CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
CREATE FUNCTION app_private.current_organization_id() RETURNS TEXT
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('app.organization_id', true), '') $$;

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Organization" USING ("id" = app_private.current_organization_id()) WITH CHECK ("id" = app_private.current_organization_id());

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "User" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "User" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

ALTER TABLE "MfaChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MfaChallenge" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MfaChallenge" USING (EXISTS (SELECT 1 FROM "User" p WHERE p."id" = "MfaChallenge"."userId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "User" p WHERE p."id" = "MfaChallenge"."userId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuthSession" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuthSession" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

ALTER TABLE "PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PasswordResetToken" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PasswordResetToken" USING (EXISTS (SELECT 1 FROM "User" p WHERE p."id" = "PasswordResetToken"."userId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "User" p WHERE p."id" = "PasswordResetToken"."userId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ClientCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ClientCase" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ClientCase" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

ALTER TABLE "HouseholdMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HouseholdMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "HouseholdMember" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "HouseholdMember"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "HouseholdMember"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "IncomeRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "IncomeRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "IncomeRecord" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "IncomeRecord"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "IncomeRecord"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "HousingProgram" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HousingProgram" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "HousingProgram" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

ALTER TABLE "ProgramRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProgramRequirement" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ProgramRequirement" USING (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "ProgramRequirement"."housingProgramId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "ProgramRequirement"."housingProgramId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "UploadedDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UploadedDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "UploadedDocument" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "UploadedDocument"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "UploadedDocument"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationTemplate" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationTemplate" USING (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "ApplicationTemplate"."housingProgramId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "ApplicationTemplate"."housingProgramId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationTemplateField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationTemplateField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationTemplateField" USING (EXISTS (SELECT 1 FROM "ApplicationTemplate" t JOIN "HousingProgram" p ON p."id" = t."housingProgramId" WHERE t."id" = "ApplicationTemplateField"."templateId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationTemplate" t JOIN "HousingProgram" p ON p."id" = t."housingProgramId" WHERE t."id" = "ApplicationTemplateField"."templateId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationDraft" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationDraft" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationDraft" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ApplicationDraft"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ApplicationDraft"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationSignature" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationSignature" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationSignature" USING (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationSignature"."draftId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationSignature"."draftId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ConsentRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ConsentRecord" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ConsentRecord" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ConsentRecord"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ConsentRecord"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "SubmissionDestination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SubmissionDestination" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "SubmissionDestination" USING (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "SubmissionDestination"."housingProgramId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "HousingProgram" p WHERE p."id" = "SubmissionDestination"."housingProgramId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationSubmission" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationSubmission" USING (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationSubmission"."draftId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationSubmission"."draftId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "BackupRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BackupRun" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BackupRun" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

ALTER TABLE "ApplicationDraftField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationDraftField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationDraftField" USING (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationDraftField"."draftId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationDraftField"."draftId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationDraftDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationDraftDocument" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationDraftDocument" USING (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationDraftDocument"."draftId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationDraft" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ApplicationDraftDocument"."draftId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ExtractedField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExtractedField" USING (EXISTS (SELECT 1 FROM "UploadedDocument" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ExtractedField"."uploadedDocumentId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "UploadedDocument" d JOIN "ClientCase" p ON p."id" = d."clientCaseId" WHERE d."id" = "ExtractedField"."uploadedDocumentId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ApplicationPacket" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationPacket" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ApplicationPacket" USING (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ApplicationPacket"."clientCaseId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" p WHERE p."id" = "ApplicationPacket"."clientCaseId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "PacketField" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PacketField" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PacketField" USING (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "PacketField"."packetId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "PacketField"."packetId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "ReviewNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewNote" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ReviewNote" USING (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "ReviewNote"."packetId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "ReviewNote"."packetId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "RequirementOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequirementOverride" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RequirementOverride" USING (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "RequirementOverride"."packetId" AND p."organizationId" = app_private.current_organization_id())) WITH CHECK (EXISTS (SELECT 1 FROM "ApplicationPacket" a JOIN "ClientCase" p ON p."id" = a."clientCaseId" WHERE a."id" = "RequirementOverride"."packetId" AND p."organizationId" = app_private.current_organization_id()));

ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AuditEvent" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());
