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
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExtractedFieldRevision_extractedFieldId_fkey" FOREIGN KEY ("extractedFieldId") REFERENCES "ExtractedField" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExtractedFieldRevision_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "ExtractedFieldRevision_extractedFieldId_createdAt_idx" ON "ExtractedFieldRevision"("extractedFieldId", "createdAt");
