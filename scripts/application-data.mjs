export const applicationDataModels = [
  "organization",
  "organizationSetupSection",
  "user",
  "mfaChallenge",
  "authSession",
  "passwordResetToken",
  "rateLimitBucket",
  "clientCase",
  "householdMember",
  "incomeRecord",
  "housingProgram",
  "programRequirement",
  "uploadedDocument",
  "applicationTemplate",
  "applicationTemplateField",
  "applicationDraft",
  "applicationSignature",
  "consentRecord",
  "submissionDestination",
  "applicationSubmission",
  "backupRun",
  "dataLifecycleRequest",
  "backgroundJob",
  "applicationDraftField",
  "applicationDraftDocument",
  "extractedField",
  "applicationPacket",
  "secureDownload",
  "packetField",
  "reviewNote",
  "requirementOverride",
  "auditEvent",
];

export async function countApplicationRows(db) {
  const counts = await Promise.all(applicationDataModels.map((model) => db[model].count()));
  return counts.reduce((total, count) => total + count, 0);
}
