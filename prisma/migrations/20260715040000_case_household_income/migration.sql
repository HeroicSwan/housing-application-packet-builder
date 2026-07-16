ALTER TABLE "ClientCase" ADD COLUMN "statusBeforeArchive" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "dueDate" DATETIME;
ALTER TABLE "ClientCase" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '|';
ALTER TABLE "ClientCase" ADD COLUMN "normalizedLegalName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClientCase" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "normalizedPhone" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "archivedAt" DATETIME;
ALTER TABLE "ClientCase" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "ClientCase" SET
  "normalizedLegalName" = lower(trim("legalName")),
  "normalizedEmail" = CASE WHEN "email" IS NULL OR trim("email") = '' THEN NULL ELSE lower(trim("email")) END,
  "normalizedPhone" = CASE WHEN "phone" IS NULL OR trim("phone") = '' THEN NULL ELSE replace(replace(replace(replace(replace(trim("phone"), ' ', ''), '-', ''), '(', ''), ')', ''), '.', '') END;

CREATE INDEX "ClientCase_organizationId_normalizedLegalName_dateOfBirth_idx" ON "ClientCase"("organizationId", "normalizedLegalName", "dateOfBirth");
CREATE INDEX "ClientCase_organizationId_dueDate_idx" ON "ClientCase"("organizationId", "dueDate");

ALTER TABLE "HouseholdMember" ADD COLUMN "householdRole" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "HouseholdMember" ADD COLUMN "sharedCustody" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HouseholdMember" ADD COLUMN "custodyPercent" INTEGER;
ALTER TABLE "HouseholdMember" ADD COLUMN "custodyNotes" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "sameAddressAsClient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HouseholdMember" ADD COLUMN "address" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HouseholdMember" ADD COLUMN "removedAt" DATETIME;
ALTER TABLE "HouseholdMember" ADD COLUMN "removalReason" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "HouseholdMember_clientCaseId_idx";
CREATE INDEX "HouseholdMember_clientCaseId_isActive_idx" ON "HouseholdMember"("clientCaseId", "isActive");

ALTER TABLE "IncomeRecord" ADD COLUMN "incomeSubtype" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "IncomeRecord" ADD COLUMN "daysPerWeek" REAL;
ALTER TABLE "IncomeRecord" ADD COLUMN "isVariable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IncomeRecord" ADD COLUMN "averagingPeriodMonths" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "monthlyOvertimeCents" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "monthlyOverrideCents" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideReason" TEXT;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideById" TEXT;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideAt" DATETIME;
ALTER TABLE "IncomeRecord" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
