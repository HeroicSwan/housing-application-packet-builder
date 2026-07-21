import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";

export async function GET() {
  const user = activateOrganizationContext(await requireRole(["ADMIN"]));
  const [fieldDefinitions, workflows, documentProfiles] = await Promise.all([
    db.agencyFieldDefinition.findMany({ where: { organizationId: user.organizationId }, orderBy: { key: "asc" } }),
    db.workflowDefinition.findMany({ where: { organizationId: user.organizationId }, orderBy: { key: "asc" } }),
    db.documentProfile.findMany({ where: { organizationId: user.organizationId }, orderBy: { key: "asc" } }),
  ]);
  return NextResponse.json({ schema: "hapb-agency-configuration/v1", exportedAt: new Date().toISOString(), fieldDefinitions: fieldDefinitions.map((field) => ({ key: field.key, label: field.label, fieldType: field.fieldType, required: field.required, validationRules: JSON.parse(field.validationRules ?? "{}"), optionsJson: JSON.parse(field.optionsJson ?? "[]"), helpText: field.helpText })), workflows: workflows.map((workflow) => ({ key: workflow.key, name: workflow.name, stages: JSON.parse(workflow.stagesJson) })), documentProfiles: documentProfiles.map((profile) => ({ key: profile.key, name: profile.name, category: profile.category, extractionPrompt: profile.extractionPrompt, required: profile.required, validationRules: JSON.parse(profile.validationRules ?? "{}") })) });
}
