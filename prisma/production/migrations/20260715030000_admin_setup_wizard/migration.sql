ALTER TABLE "Organization" ADD COLUMN "jurisdiction" TEXT;
ALTER TABLE "Organization" ADD COLUMN "contactName" TEXT;
ALTER TABLE "Organization" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "Organization" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "Organization" ADD COLUMN "documentRetentionDays" INTEGER NOT NULL DEFAULT 2555;
ALTER TABLE "Organization" ADD COLUMN "auditRetentionDays" INTEGER NOT NULL DEFAULT 3650;
ALTER TABLE "Organization" ADD COLUMN "legalHoldPolicy" TEXT;
ALTER TABLE "Organization" ADD COLUMN "sessionDurationMinutes" INTEGER NOT NULL DEFAULT 480;
ALTER TABLE "Organization" ADD COLUMN "sessionIdleMinutes" INTEGER NOT NULL DEFAULT 60;
ALTER TABLE "Organization" ADD COLUMN "passwordMinLength" INTEGER NOT NULL DEFAULT 12;
ALTER TABLE "Organization" ADD COLUMN "passwordRequireUppercase" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "passwordRequireNumber" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Organization" ADD COLUMN "requireMfa" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Organization" ADD COLUMN "setupStatus" TEXT NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "Organization" ADD COLUMN "setupCurrentStep" TEXT NOT NULL DEFAULT 'organization';
ALTER TABLE "Organization" ADD COLUMN "setupRevision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Organization" ADD COLUMN "installationBootstrapKey" TEXT;
ALTER TABLE "Organization" ADD COLUMN "setupStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Organization" ADD COLUMN "setupCompletedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "setupCompletedById" TEXT;
ALTER TABLE "Organization" ADD COLUMN "setupReopenedAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN "setupLegalAcknowledgedAt" TIMESTAMP(3);

CREATE TABLE "OrganizationSetupSection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "configurationJson" TEXT NOT NULL DEFAULT '{}',
    "secretEncrypted" TEXT,
    "activeConfigurationJson" TEXT,
    "activeSecretEncrypted" TEXT,
    "activatedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "lastTestCode" TEXT,
    "lastTestDurationMs" INTEGER,
    "configurationFingerprint" TEXT,
    "lastTestSummary" TEXT,
    "updatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationSetupSection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationSetupSection_organizationId_section_key" ON "OrganizationSetupSection"("organizationId", "section");
CREATE INDEX "OrganizationSetupSection_organizationId_section_completedAt_idx" ON "OrganizationSetupSection"("organizationId", "section", "completedAt");
CREATE UNIQUE INDEX "Organization_installationBootstrapKey_key" ON "Organization"("installationBootstrapKey");
UPDATE "Organization" SET "installationBootstrapKey" = 'PRIMARY_INSTALLATION' WHERE "id" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
ALTER TABLE "OrganizationSetupSection" ADD CONSTRAINT "OrganizationSetupSection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationSetupSection" ADD CONSTRAINT "OrganizationSetupSection_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationSetupSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationSetupSection" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrganizationSetupSection" USING ("organizationId" = app_private.current_organization_id()) WITH CHECK ("organizationId" = app_private.current_organization_id());

CREATE OR REPLACE FUNCTION app_private.bootstrap_installation(
  organization_id TEXT,
  organization_slug TEXT,
  organization_name TEXT,
  administrator_id TEXT,
  administrator_name TEXT,
  administrator_email TEXT,
  administrator_password_hash TEXT,
  audit_id TEXT
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, app_private AS $$
BEGIN
  LOCK TABLE "Organization", "User" IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM "Organization") OR EXISTS (SELECT 1 FROM "User") THEN
    RAISE EXCEPTION 'installation_already_claimed';
  END IF;
  INSERT INTO "Organization" ("id", "slug", "name", "installationBootstrapKey", "updatedAt")
    VALUES (organization_id, organization_slug, organization_name, 'PRIMARY_INSTALLATION', CURRENT_TIMESTAMP);
  INSERT INTO "User" ("id", "organizationId", "name", "email", "passwordHash", "role")
    VALUES (administrator_id, organization_id, administrator_name, administrator_email, administrator_password_hash, 'ADMIN');
  PERFORM set_config('app.organization_id', organization_id, true);
  INSERT INTO "AuditEvent" ("id", "organizationId", "userId", "action", "entityType", "entityId", "metadata")
    VALUES (audit_id, organization_id, administrator_id, 'INSTALLATION_BOOTSTRAPPED', 'Organization', organization_id, 'First administrator created; bootstrap credential was not stored');
  RETURN administrator_id;
END;
$$;
REVOKE ALL ON FUNCTION app_private.bootstrap_installation(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
