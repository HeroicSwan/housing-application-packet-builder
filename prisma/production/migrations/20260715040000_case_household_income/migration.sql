ALTER TABLE "ClientCase" ADD COLUMN "statusBeforeArchive" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "dueDate" TIMESTAMP(3);
ALTER TABLE "ClientCase" ADD COLUMN "internalNote" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "tags" TEXT NOT NULL DEFAULT '|';
ALTER TABLE "ClientCase" ADD COLUMN "normalizedLegalName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ClientCase" ADD COLUMN "normalizedEmail" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "normalizedPhone" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "ClientCase" ADD COLUMN "archiveReason" TEXT;
ALTER TABLE "ClientCase" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;

UPDATE "ClientCase" SET
  "normalizedLegalName" = lower(trim("legalName")),
  "normalizedEmail" = NULLIF(lower(trim("email")), ''),
  "normalizedPhone" = NULLIF(regexp_replace("phone", '[^0-9]', '', 'g'), '');

CREATE INDEX "ClientCase_organizationId_normalizedLegalName_dateOfBirth_idx" ON "ClientCase"("organizationId", "normalizedLegalName", "dateOfBirth");
CREATE INDEX "ClientCase_organizationId_dueDate_idx" ON "ClientCase"("organizationId", "dueDate");

ALTER TABLE "HouseholdMember" ADD COLUMN "householdRole" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "HouseholdMember" ADD COLUMN "sharedCustody" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "HouseholdMember" ADD COLUMN "custodyPercent" INTEGER;
ALTER TABLE "HouseholdMember" ADD COLUMN "custodyNotes" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "sameAddressAsClient" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HouseholdMember" ADD COLUMN "address" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "HouseholdMember" ADD COLUMN "removedAt" TIMESTAMP(3);
ALTER TABLE "HouseholdMember" ADD COLUMN "removalReason" TEXT;
ALTER TABLE "HouseholdMember" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
DROP INDEX "HouseholdMember_clientCaseId_idx";
CREATE INDEX "HouseholdMember_clientCaseId_isActive_idx" ON "HouseholdMember"("clientCaseId", "isActive");

ALTER TABLE "IncomeRecord" ADD COLUMN "incomeSubtype" TEXT NOT NULL DEFAULT 'OTHER';
ALTER TABLE "IncomeRecord" ADD COLUMN "daysPerWeek" DOUBLE PRECISION;
ALTER TABLE "IncomeRecord" ADD COLUMN "isVariable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "IncomeRecord" ADD COLUMN "averagingPeriodMonths" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "monthlyOvertimeCents" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "monthlyOverrideCents" INTEGER;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideReason" TEXT;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideById" TEXT;
ALTER TABLE "IncomeRecord" ADD COLUMN "overrideAt" TIMESTAMP(3);
ALTER TABLE "IncomeRecord" ADD COLUMN "recordVersion" INTEGER NOT NULL DEFAULT 0;
