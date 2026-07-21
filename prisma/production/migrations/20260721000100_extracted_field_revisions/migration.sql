CREATE TABLE "ExtractedFieldRevision" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "extractedFieldId" TEXT NOT NULL,
  "reviewerId" TEXT,
  "beforeValue" TEXT,
  "afterValue" TEXT,
  "beforeStatus" TEXT NOT NULL,
  "afterStatus" TEXT NOT NULL,
  "beforeReason" TEXT,
  "afterReason" TEXT,
  "sourceRevision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtractedFieldRevision_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "ExtractedField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExtractedFieldRevision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ExtractedFieldRevision_extractedFieldId_createdAt_idx" ON "ExtractedFieldRevision"("extractedFieldId", "createdAt");
ALTER TABLE "ExtractedFieldRevision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExtractedFieldRevision" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ExtractedFieldRevision"
  USING (EXISTS (SELECT 1 FROM "ExtractedField" field JOIN "UploadedDocument" document ON document."id" = field."uploadedDocumentId" JOIN "ClientCase" client_case ON client_case."id" = document."clientCaseId" WHERE field."id" = "ExtractedFieldRevision"."extractedFieldId" AND client_case."organizationId" = nullif(current_setting('app.organization_id', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "ExtractedField" field JOIN "UploadedDocument" document ON document."id" = field."uploadedDocumentId" JOIN "ClientCase" client_case ON client_case."id" = document."clientCaseId" WHERE field."id" = "ExtractedFieldRevision"."extractedFieldId" AND client_case."organizationId" = nullif(current_setting('app.organization_id', true), '')));
