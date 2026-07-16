-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Existing Phase 0 databases contain synthetic demonstration records only.
-- Assign those rows to the single synthetic organization before tenant enforcement starts.
INSERT INTO "Organization" ("id", "slug", "name", "isActive", "createdAt", "updatedAt")
VALUES ('synthetic-demo-organization', 'synthetic-housing-demo', 'Synthetic Housing Demonstration', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "clientCaseId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AuditEvent" ("action", "clientCaseId", "createdAt", "entityId", "entityType", "id", "metadata", "userId") SELECT "action", "clientCaseId", "createdAt", "entityId", "entityType", "id", "metadata", "userId" FROM "AuditEvent";
DROP TABLE "AuditEvent";
ALTER TABLE "new_AuditEvent" RENAME TO "AuditEvent";
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_clientCaseId_createdAt_idx" ON "AuditEvent"("clientCaseId", "createdAt");
CREATE TABLE "new_AuthSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" DATETIME,
    "ipHash" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "AuthSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_AuthSession" ("createdAt", "expiresAt", "id", "ipHash", "lastSeenAt", "revokedAt", "tokenHash", "userAgent", "userId") SELECT "createdAt", "expiresAt", "id", "ipHash", "lastSeenAt", "revokedAt", "tokenHash", "userAgent", "userId" FROM "AuthSession";
DROP TABLE "AuthSession";
ALTER TABLE "new_AuthSession" RENAME TO "AuthSession";
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");
CREATE INDEX "AuthSession_organizationId_expiresAt_idx" ON "AuthSession"("organizationId", "expiresAt");
CREATE TABLE "new_BackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT,
    "checksum" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "BackupRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BackupRun" ("checksum", "completedAt", "errorMessage", "id", "provider", "startedAt", "status", "storageKey") SELECT "checksum", "completedAt", "errorMessage", "id", "provider", "startedAt", "status", "storageKey" FROM "BackupRun";
DROP TABLE "BackupRun";
ALTER TABLE "new_BackupRun" RENAME TO "BackupRun";
CREATE INDEX "BackupRun_organizationId_startedAt_idx" ON "BackupRun"("organizationId", "startedAt");
CREATE TABLE "new_ClientCase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
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
    CONSTRAINT "ClientCase_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ClientCase_assignedCaseworkerId_fkey" FOREIGN KEY ("assignedCaseworkerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClientCase_selectedProgramId_fkey" FOREIGN KEY ("selectedProgramId") REFERENCES "HousingProgram" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ClientCase" ("accessibilityNeeds", "assignedCaseworkerId", "benefitPrograms", "consentConfirmedAt", "contactPermission", "createdAt", "currentLivingSituation", "dateOfBirth", "desiredMoveInDate", "email", "emergencyContact", "evictionHistory", "id", "legalName", "mailingAddress", "monthlyBenefitsIncomeCents", "monthlyEarnedIncomeCents", "notes", "otherIncomeCents", "phone", "preferredLanguage", "preferredName", "previousAddress", "referenceNumber", "rentalArrearsCents", "selectedProgramId", "status", "transportationNeeds", "updatedAt", "veteranStatus") SELECT "accessibilityNeeds", "assignedCaseworkerId", "benefitPrograms", "consentConfirmedAt", "contactPermission", "createdAt", "currentLivingSituation", "dateOfBirth", "desiredMoveInDate", "email", "emergencyContact", "evictionHistory", "id", "legalName", "mailingAddress", "monthlyBenefitsIncomeCents", "monthlyEarnedIncomeCents", "notes", "otherIncomeCents", "phone", "preferredLanguage", "preferredName", "previousAddress", "referenceNumber", "rentalArrearsCents", "selectedProgramId", "status", "transportationNeeds", "updatedAt", "veteranStatus" FROM "ClientCase";
DROP TABLE "ClientCase";
ALTER TABLE "new_ClientCase" RENAME TO "ClientCase";
CREATE INDEX "ClientCase_assignedCaseworkerId_status_idx" ON "ClientCase"("assignedCaseworkerId", "status");
CREATE INDEX "ClientCase_organizationId_status_idx" ON "ClientCase"("organizationId", "status");
CREATE UNIQUE INDEX "ClientCase_organizationId_referenceNumber_key" ON "ClientCase"("organizationId", "referenceNumber");
CREATE TABLE "new_HousingProgram" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "HousingProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_HousingProgram" ("accessibilityNotes", "applicationDeadline", "contactInformation", "createdAt", "description", "fictional", "householdRestrictions", "id", "incomeLimitNotes", "isActive", "name", "organization", "updatedAt") SELECT "accessibilityNotes", "applicationDeadline", "contactInformation", "createdAt", "description", "fictional", "householdRestrictions", "id", "incomeLimitNotes", "isActive", "name", "organization", "updatedAt" FROM "HousingProgram";
DROP TABLE "HousingProgram";
ALTER TABLE "new_HousingProgram" RENAME TO "HousingProgram";
CREATE INDEX "HousingProgram_organizationId_isActive_idx" ON "HousingProgram"("organizationId", "isActive");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "failedLoginCount", "id", "isActive", "lockedUntil", "mfaEnabled", "mfaRecoveryCodesEncrypted", "mfaSecretEncrypted", "name", "passwordChangedAt", "passwordHash", "role") SELECT "createdAt", "email", "failedLoginCount", "id", "isActive", "lockedUntil", "mfaEnabled", "mfaRecoveryCodesEncrypted", "mfaSecretEncrypted", "name", "passwordChangedAt", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_organizationId_role_isActive_idx" ON "User"("organizationId", "role", "isActive");
UPDATE "User" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
UPDATE "AuthSession" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
UPDATE "ClientCase" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
UPDATE "HousingProgram" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
UPDATE "AuditEvent" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
UPDATE "BackupRun" SET "organizationId" = 'synthetic-demo-organization' WHERE "organizationId" IS NULL;
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
