CREATE TABLE "AgencyFieldDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "fieldType" TEXT NOT NULL DEFAULT 'TEXT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "validationRules" TEXT,
  "optionsJson" TEXT,
  "helpText" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AgencyFieldDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AgencyFieldDefinition_organizationId_key_key" ON "AgencyFieldDefinition"("organizationId", "key");
CREATE INDEX "AgencyFieldDefinition_organizationId_active_idx" ON "AgencyFieldDefinition"("organizationId", "active");
ALTER TABLE "AgencyFieldDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgencyFieldDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AgencyFieldDefinition" USING ("organizationId" = nullif(current_setting('app.organization_id', true), '')) WITH CHECK ("organizationId" = nullif(current_setting('app.organization_id', true), ''));

CREATE TABLE "CaseFieldValue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "clientCaseId" TEXT NOT NULL,
  "definitionId" TEXT NOT NULL,
  "value" TEXT,
  "sourceType" TEXT NOT NULL DEFAULT 'STAFF_ENTRY',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CaseFieldValue_clientCaseId_fkey" FOREIGN KEY ("clientCaseId") REFERENCES "ClientCase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CaseFieldValue_definitionId_fkey" FOREIGN KEY ("definitionId") REFERENCES "AgencyFieldDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CaseFieldValue_clientCaseId_definitionId_key" ON "CaseFieldValue"("clientCaseId", "definitionId");
CREATE INDEX "CaseFieldValue_clientCaseId_idx" ON "CaseFieldValue"("clientCaseId");
ALTER TABLE "CaseFieldValue" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CaseFieldValue" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "CaseFieldValue" USING (EXISTS (SELECT 1 FROM "ClientCase" c WHERE c."id" = "CaseFieldValue"."clientCaseId" AND c."organizationId" = nullif(current_setting('app.organization_id', true), ''))) WITH CHECK (EXISTS (SELECT 1 FROM "ClientCase" c WHERE c."id" = "CaseFieldValue"."clientCaseId" AND c."organizationId" = nullif(current_setting('app.organization_id', true), '')));

CREATE TABLE "WorkflowDefinition" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "stagesJson" TEXT NOT NULL DEFAULT '[]',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "WorkflowDefinition_organizationId_key_key" ON "WorkflowDefinition"("organizationId", "key");
CREATE INDEX "WorkflowDefinition_organizationId_active_idx" ON "WorkflowDefinition"("organizationId", "active");
ALTER TABLE "WorkflowDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowDefinition" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "WorkflowDefinition" USING ("organizationId" = nullif(current_setting('app.organization_id', true), '')) WITH CHECK ("organizationId" = nullif(current_setting('app.organization_id', true), ''));

CREATE TABLE "DocumentProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "extractionPrompt" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "validationRules" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "DocumentProfile_organizationId_key_key" ON "DocumentProfile"("organizationId", "key");
CREATE INDEX "DocumentProfile_organizationId_category_active_idx" ON "DocumentProfile"("organizationId", "category", "active");
ALTER TABLE "DocumentProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DocumentProfile" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "DocumentProfile" USING ("organizationId" = nullif(current_setting('app.organization_id', true), '')) WITH CHECK ("organizationId" = nullif(current_setting('app.organization_id', true), ''));
