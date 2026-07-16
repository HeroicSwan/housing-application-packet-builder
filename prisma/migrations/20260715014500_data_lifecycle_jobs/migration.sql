ALTER TABLE "ClientCase" ADD COLUMN "legalHoldAt" DATETIME;
ALTER TABLE "ClientCase" ADD COLUMN "legalHoldReason" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "retentionExpiresAt" DATETIME;

CREATE TABLE "DataLifecycleRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "clientCaseId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "executeAfter" DATETIME,
    "exportStorageKey" TEXT,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "requestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "DataLifecycleRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DataLifecycleRequest_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "DataLifecycleRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DataLifecycleRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT,
    "jobType" TEXT NOT NULL,
    "payloadEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "runAfter" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" DATETIME,
    "lockedBy" TEXT,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "completedAt" DATETIME,
    CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

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
    "previousHash" TEXT,
    "eventHash" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AuditEvent" ("action", "clientCaseId", "createdAt", "entityId", "entityType", "id", "metadata", "organizationId", "userId") SELECT "action", "clientCaseId", "createdAt", "entityId", "entityType", "id", "metadata", "organizationId", "userId" FROM "AuditEvent";
DROP TABLE "AuditEvent";
ALTER TABLE "new_AuditEvent" RENAME TO "AuditEvent";
CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");
CREATE INDEX "AuditEvent_clientCaseId_createdAt_idx" ON "AuditEvent"("clientCaseId", "createdAt");
CREATE TABLE "new_BackupRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "storageKey" TEXT,
    "checksum" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "errorMessage" TEXT
);
INSERT INTO "new_BackupRun" ("checksum", "completedAt", "errorMessage", "id", "provider", "startedAt", "status", "storageKey") SELECT "checksum", "completedAt", "errorMessage", "id", "provider", "startedAt", "status", "storageKey" FROM "BackupRun";
DROP TABLE "BackupRun";
ALTER TABLE "new_BackupRun" RENAME TO "BackupRun";
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 2555,
    "deletionGraceDays" INTEGER NOT NULL DEFAULT 30
);
INSERT INTO "new_Organization" ("createdAt", "id", "isActive", "name", "slug", "updatedAt") SELECT "createdAt", "id", "isActive", "name", "slug", "updatedAt" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

CREATE INDEX "DataLifecycleRequest_organizationId_status_executeAfter_idx" ON "DataLifecycleRequest"("organizationId", "status", "executeAfter");
CREATE INDEX "DataLifecycleRequest_clientCaseId_requestedAt_idx" ON "DataLifecycleRequest"("clientCaseId", "requestedAt");
CREATE INDEX "BackgroundJob_organizationId_status_runAfter_idx" ON "BackgroundJob"("organizationId", "status", "runAfter");
CREATE UNIQUE INDEX "BackgroundJob_organizationId_dedupeKey_key" ON "BackgroundJob"("organizationId", "dedupeKey");
