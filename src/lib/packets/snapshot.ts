import { z } from "zod";
import { detectInconsistencies, type CaseFacts, type ExtractedValue } from "@/lib/requirements/inconsistencies";
import { evaluateRequirements, type DocumentInput, type RequirementInput } from "@/lib/requirements/engine";

export const packetSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  caseReference: z.string(),
  client: z.object({ legalName: z.string(), preferredName: z.string().nullable(), dateOfBirth: z.string().nullable(), preferredLanguage: z.string().nullable(), currentLivingSituation: z.string().nullable(), accessibilityNeeds: z.string().nullable() }),
  household: z.array(z.object({ name: z.string(), relationship: z.string(), dateOfBirth: z.string().nullable(), monthlyIncomeCents: z.number().int().nullable(), incomeSource: z.string().nullable() })),
  program: z.object({ name: z.string(), organization: z.string(), description: z.string(), fictional: z.boolean() }),
  requirements: z.array(z.object({ id: z.string(), name: z.string(), category: z.string(), isRequired: z.boolean(), state: z.enum(["SATISFIED", "MISSING", "EXPIRED", "NEEDS_REVIEW", "CONFLICT", "NOT_APPLICABLE"]), reason: z.string() })),
  documents: z.array(z.object({ originalFilename: z.string(), fileType: z.string(), category: z.string(), uploadedAt: z.string(), expirationDate: z.string().nullable(), processingStatus: z.string(), reviewedFields: z.array(z.object({ fieldName: z.string(), value: z.string(), reviewStatus: z.string(), sourcePage: z.number().nullable(), sourceText: z.string().nullable() })) })),
  reviewItems: z.array(z.object({ code: z.string(), severity: z.enum(["REVIEW", "BLOCKING"]), message: z.string(), categories: z.array(z.string()) })),
  missingInformation: z.array(z.string()),
});

export type PacketSnapshot = z.infer<typeof packetSnapshotSchema>;

type SnapshotInput = {
  generatedAt: Date;
  caseReference: string;
  client: PacketSnapshot["client"];
  household: PacketSnapshot["household"];
  program: PacketSnapshot["program"];
  requirements: RequirementInput[];
  documents: Array<DocumentInput & { originalFilename: string; fileType: string; uploadedAt: Date; processingStatus: string; extractedFields: NonNullable<DocumentInput["extractedFields"]> }>;
  extractedValues: ExtractedValue[];
  caseFacts: CaseFacts;
};

export function buildPacketSnapshot(input: SnapshotInput): PacketSnapshot {
  const reviewItems = detectInconsistencies(input.caseFacts, input.extractedValues);
  const requirements = evaluateRequirements(input.requirements, input.documents, reviewItems, input.caseFacts, input.generatedAt);
  return packetSnapshotSchema.parse({
    schemaVersion: 1,
    generatedAt: input.generatedAt.toISOString(),
    caseReference: input.caseReference,
    client: input.client,
    household: input.household,
    program: input.program,
    requirements: requirements.map(({ id, name, category, isRequired, state, reason }) => ({ id, name, category, isRequired, state, reason })),
    documents: input.documents.map((document) => ({
      originalFilename: document.originalFilename,
      fileType: document.fileType,
      category: document.category,
      uploadedAt: document.uploadedAt.toISOString(),
      expirationDate: document.expirationDate?.toISOString() ?? null,
      processingStatus: document.processingStatus,
      reviewedFields: document.extractedFields.map((field) => ({ fieldName: field.fieldName, value: field.reviewedValue ?? field.extractedValue, reviewStatus: field.reviewStatus, sourcePage: field.sourcePage, sourceText: field.sourceText })),
    })),
    reviewItems,
    missingInformation: requirements.filter((item) => item.isRequired && item.state !== "SATISFIED").map((item) => `${item.name}: ${item.reason}`),
  });
}

export function parsePacketSnapshot(snapshotJson: string) {
  return packetSnapshotSchema.parse(JSON.parse(snapshotJson));
}
