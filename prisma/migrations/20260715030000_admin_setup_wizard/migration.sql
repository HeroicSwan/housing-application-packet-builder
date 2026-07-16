PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 2555,
    "documentRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 3650,
    "deletionGraceDays" INTEGER NOT NULL DEFAULT 30,
    "legalHoldPolicy" TEXT,
    "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 480,
    "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 60,
    "passwordMinLength" INTEGER NOT NULL DEFAULT 12,
    "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true,
    "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true,
    "requireMfa" BOOLEAN NOT NULL DEFAULT false,
    "setupStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "setupCurrentStep" TEXT NOT NULL DEFAULT 'organization',
    "setupRevision" INTEGER NOT NULL DEFAULT 0,
    "installationBootstrapKey" TEXT,
    "setupStartedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "setupCompletedAt" DATETIME,
    "setupCompletedById" TEXT,
    "setupReopenedAt" DATETIME,
    "setupLegalAcknowledgedAt" DATETIME
);
INSERT INTO "new_Organization" ("id", "slug", "name", "isActive", "createdAt", "updatedAt", "retentionDays", "deletionGraceDays") SELECT "id", "slug", "name", "isActive", "createdAt", "updatedAt", "retentionDays", "deletionGraceDays" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrganizationSetupSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "section" TEXT NOT NULL,
    "configurationJson" TEXT NOT NULL DEFAULT '{}',
    "secretEncrypted" TEXT,
    "activeConfigurationJson" TEXT,
    "activeSecretEncrypted" TEXT,
    "activatedAt" DATETIME,
    "completedAt" DATETIME,
    "lastTestedAt" DATETIME,
    "lastTestStatus" TEXT,
    "lastTestCode" TEXT,
    "lastTestDurationMs" INTEGER,
    "configurationFingerprint" TEXT,
    "lastTestSummary" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrganizationSetupSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrganizationSetupSection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationSetupSection_organizationId_section_key" ON "OrganizationSetupSection"("organizationId", "section");
CREATE INDEX "OrganizationSetupSection_organizationId_section_completedAt_idx" ON "OrganizationSetupSection"("organizationId", "section", "completedAt");
CREATE UNIQUE INDEX "Organization_installationBootstrapKey_key" ON "Organization"("installationBootstrapKey");
UPDATE "Organization" SET "installationBootstrapKey" = 'PRIMARY_INSTALLATION' WHERE "id" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
