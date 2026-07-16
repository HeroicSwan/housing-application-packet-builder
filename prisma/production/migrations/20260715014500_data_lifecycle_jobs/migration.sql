CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP POLICY tenant_isolation ON "BackupRun";
ALTER TABLE "BackupRun" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "BackupRun" DROP CONSTRAINT "BackupRun_organizationId_fkey";
DROP INDEX "BackupRun_organizationId_startedAt_idx";
ALTER TABLE "BackupRun" DROP COLUMN "organizationId";

ALTER TABLE "Organization" ADD COLUMN "retentionDays" INTEGER NOT NULL DEFAULT 2555;
ALTER TABLE "Organization" ADD COLUMN "deletionGraceDays" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "ClientCase" ADD COLUMN "retentionExpiresAt" TIMESTAMP(3);
ALTER TABLE "ClientCase" ADD COLUMN "legalHoldAt" TIMESTAMP(3);
ALTER TABLE "ClientCase" ADD COLUMN "legalHoldReason" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "previousHash" TEXT;
ALTER TABLE "AuditEvent" ADD COLUMN "eventHash" TEXT;
ALTER TABLE "AuditEvent" DROP CONSTRAINT "AuditEvent_clientCaseId_fkey";

CREATE TABLE "DataLifecycleRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientCaseId" TEXT,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "requestType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "executeAfter" TIMESTAMP(3),
    "exportStorageKey" TEXT,
    "checksum" TEXT,
    "errorMessage" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "DataLifecycleRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payloadEncrypted" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 8,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AuditEvent_eventHash_key" ON "AuditEvent"("eventHash");
CREATE INDEX "DataLifecycleRequest_organizationId_status_executeAfter_idx" ON "DataLifecycleRequest"("organizationId", "status", "executeAfter");
CREATE INDEX "DataLifecycleRequest_clientCaseId_requestedAt_idx" ON "DataLifecycleRequest"("clientCaseId", "requestedAt");
CREATE UNIQUE INDEX "BackgroundJob_organizationId_dedupeKey_key" ON "BackgroundJob"("organizationId", "dedupeKey");
CREATE INDEX "BackgroundJob_organizationId_status_runAfter_idx" ON "BackgroundJob"("organizationId", "status", "runAfter");

ALTER TABLE "DataLifecycleRequest" ADD CONSTRAINT "DataLifecycleRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataLifecycleRequest" ADD CONSTRAINT "DataLifecycleRequest_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DataLifecycleRequest" ADD CONSTRAINT "DataLifecycleRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DataLifecycleRequest" ADD CONSTRAINT "DataLifecycleRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BackgroundJob" ADD CONSTRAINT "BackgroundJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DataLifecycleRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DataLifecycleRequest" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DataLifecycleRequest" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());
ALTER TABLE "BackgroundJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BackgroundJob" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BackgroundJob" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

CREATE OR REPLACE FUNCTION app_private.seal_audit_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app_private AS $$
DECLARE
  prior_hash TEXT;
  canonical TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW."organizationId", 0));
  SELECT "eventHash" INTO prior_hash FROM "AuditEvent"
    WHERE "organizationId" = NEW."organizationId"
    ORDER BY "createdAt" DESC, "id" DESC LIMIT 1;
  NEW."previousHash" := prior_hash;
  canonical := concat_ws('|', NEW."organizationId", NEW."userId", coalesce(NEW."clientCaseId", ''), NEW.action, NEW."entityType", NEW."entityId", coalesce(NEW.metadata, ''), NEW."createdAt"::text, coalesce(prior_hash, 'GENESIS'));
  NEW."eventHash" := encode(digest(convert_to(canonical, 'UTF8'), 'sha256'), 'hex');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION app_private.reject_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Audit events are append-only';
END;
$$;

DO $$
DECLARE
  row_data RECORD;
  current_org TEXT := NULL;
  prior_hash TEXT := NULL;
  canonical TEXT;
  calculated_hash TEXT;
BEGIN
  FOR row_data IN SELECT * FROM "AuditEvent" ORDER BY "organizationId", "createdAt", "id" LOOP
    IF current_org IS DISTINCT FROM row_data."organizationId" THEN
      current_org := row_data."organizationId";
      prior_hash := NULL;
    END IF;
    canonical := concat_ws('|', row_data."organizationId", row_data."userId", coalesce(row_data."clientCaseId", ''), row_data.action, row_data."entityType", row_data."entityId", coalesce(row_data.metadata, ''), row_data."createdAt"::text, coalesce(prior_hash, 'GENESIS'));
    calculated_hash := encode(digest(convert_to(canonical, 'UTF8'), 'sha256'), 'hex');
    UPDATE "AuditEvent" SET "previousHash" = prior_hash, "eventHash" = calculated_hash WHERE id = row_data.id;
    prior_hash := calculated_hash;
  END LOOP;
END;
$$;

CREATE TRIGGER audit_event_seal BEFORE INSERT ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION app_private.seal_audit_event();
CREATE TRIGGER audit_event_append_only BEFORE UPDATE OR DELETE ON "AuditEvent" FOR EACH ROW EXECUTE FUNCTION app_private.reject_audit_mutation();
