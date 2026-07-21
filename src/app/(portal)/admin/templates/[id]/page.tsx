import Link from "next/link";
import { notFound } from "next/navigation";
import {
  addApplicationTemplateFieldAction,
  cloneApplicationTemplateVersionAction,
  deprecateApplicationTemplateAction,
  approveTemplateAcceptanceAction,
  recordTemplateSandboxTestAction,
  uploadTemplateAcceptanceAction,
  publishApplicationTemplateAction,
  rollbackApplicationTemplateAction,
  updateApplicationTemplateFieldAction,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { compareTemplateVersions } from "@/lib/applications/template-compatibility";

const canonicalPaths = [
  "",
  "client.legalName",
  "client.preferredName",
  "client.dateOfBirth",
  "client.mailingAddress",
  "client.previousAddress",
  "client.phone",
  "client.email",
  "client.preferredContactMethod",
  "client.preferredLanguage",
  "client.currentLivingSituation",
  "client.accessibilityNeeds",
  "client.emergencyContact",
  "client.veteranStatus",
  "client.benefitPrograms",
  "finances.monthlyEarnedIncome",
  "finances.monthlyBenefitsIncome",
  "finances.otherIncome",
  "derived.totalMonthlyIncome",
  "derived.householdSize",
  "household.members",
  "client.desiredMoveInDate",
  "client.transportationNeeds",
  "client.evictionHistory",
  "client.rentalArrears",
  "client.contactPermission",
  "client.consentConfirmed",
  "documents.identificationExpirationDate",
  "assignedCaseworker.name",
  "application.applicationDate",
];
const fieldTypes = [
  "TEXT",
  "DATE",
  "CURRENCY",
  "BOOLEAN",
  "SELECT",
  "REPEATING_GROUP",
  "SIGNATURE",
];

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const { id } = await params;
  const [template, customDefinitions] = await Promise.all([db.applicationTemplate.findUnique({
    where: { id },
    include: {
      housingProgram: true,
      fields: { orderBy: { displayOrder: "asc" } },
      supersedesTemplate: { include: { fields: true } },
    },
  }), db.agencyFieldDefinition.findMany({ where: { organizationId: admin.organizationId, active: true }, orderBy: { key: "asc" } })]);
  if (!template) notFound();
  const editable = template.status === "DRAFT";
  const compatibility = template.supersedesTemplate ? compareTemplateVersions(template.supersedesTemplate.fields, template.fields) : { compatible: true, blockers: [], added: [], removed: [], changed: [] };
  const availablePaths = [...canonicalPaths.filter(Boolean), ...customDefinitions.map((definition) => `custom.${definition.key}`)];
  return (
    <div>
      <Link
        href={`/admin/programs/${template.housingProgramId}`}
        className="text-sm text-primary underline underline-offset-4"
      >
        Back to {template.housingProgram.name}
      </Link>
      <div className="mt-8 flex flex-wrap items-start justify-between gap-5 border-b pb-7">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            Template version {template.version}
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em]">
            {template.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {template.templateType === "ACROFORM"
              ? "Agency AcroForm"
              : "Generated PDF"}{" "}
            · {template.fields.length} fields
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={template.status} />
          {editable ? (
            <form action={publishApplicationTemplateAction.bind(null, id)}>
              <SubmitButton pendingLabel="Publishing…">
                Publish version
              </SubmitButton>
            </form>
          ) : (
            <form action={cloneApplicationTemplateVersionAction.bind(null, id)}>
              <SubmitButton variant="outline" pendingLabel="Creating…">
                Create new version
              </SubmitButton>
            </form>
          )}
        </div>
      </div>
      <section className="mt-6 grid gap-4 border bg-white p-5 lg:grid-cols-2">
        <div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Deployment gates</p><h2 className="mt-1 text-lg font-semibold">{template.requiresAgencyAcceptance ? "Real agency template" : "Synthetic / internal template"}</h2><p className="mt-2 text-sm text-muted-foreground">{template.requiresAgencyAcceptance ? "Publication is blocked until the approved PDF, mapping rules, sandbox evidence, and signed agency acceptance are all recorded." : "This version can be used for synthetic QA. Mark real agency templates at creation so external acceptance cannot be skipped."}</p><div className="mt-4 grid gap-2 text-xs"><Gate label="Compatibility" value={compatibility.compatible ? "PASS" : "BLOCKED"} /><Gate label="Sandbox submission" value={template.sandboxTestStatus} /><Gate label="Signed acceptance" value={template.requiresAgencyAcceptance ? template.acceptanceStatus : "NOT_REQUIRED"} /></div></div>
        <div className="border-l pl-5"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Compatibility report</p><p className="mt-2 text-sm text-muted-foreground">{template.supersedesTemplate ? `Compared with version ${template.supersedesTemplate.version}.` : "This is the first version; future upgrades will be compared against it."}</p>{compatibility.blockers.length > 0 && <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-red-700">{compatibility.blockers.map((item) => <li key={item}>{item}</li>)}</ul>}{template.supersedesTemplate && <p className="mt-3 text-xs text-muted-foreground">Added {compatibility.added.length} · changed {compatibility.changed.length} · removed {compatibility.removed.length}</p>}</div>
      </section>
      {template.requiresAgencyAcceptance && <section className="mt-6 grid gap-4 lg:grid-cols-2">
        <form action={uploadTemplateAcceptanceAction.bind(null, id)} encType="multipart/form-data" className="border bg-white p-5"><h2 className="text-lg font-semibold">Signed agency acceptance</h2><p className="mt-1 text-xs text-muted-foreground">Upload the signed acceptance record supplied by the agency. An administrator must verify it before publication.</p><div className="mt-4 grid gap-3"><Input name="signerName" placeholder="Agency signer name" required /><Input name="signerEmail" type="email" placeholder="Agency signer email" required /><Input name="signedAt" type="date" required /><Input name="acceptanceRecord" type="file" accept="application/pdf,image/png,image/jpeg" required /><SubmitButton pendingLabel="Uploading record…">Upload acceptance record</SubmitButton></div></form>
        <div className="border bg-white p-5"><h2 className="text-lg font-semibold">Acceptance status</h2><p className="mt-2 text-sm">{template.acceptanceStatus === "PENDING" ? "No signed record has been uploaded." : `${template.acceptanceStatus} · ${template.acceptanceSignerName ?? "Signer not recorded"}${template.acceptanceSignedAt ? ` · signed ${template.acceptanceSignedAt.toLocaleDateString()}` : ""}`}</p>{template.acceptanceStatus === "RECEIVED" && <form action={approveTemplateAcceptanceAction.bind(null, id)} className="mt-4"><SubmitButton pendingLabel="Verifying…">Verify signed record</SubmitButton></form>}</div>
      </section>}
      {template.requiresAgencyAcceptance && <section className="mt-6 border bg-white p-5"><h2 className="text-lg font-semibold">Sandbox submission evidence</h2><p className="mt-1 text-xs text-muted-foreground">Run the generated application through the agency’s sandbox endpoint or portal, then record the provider receipt. This form records evidence; it does not claim a provider accepted anything automatically.</p><form action={recordTemplateSandboxTestAction.bind(null, id)} className="mt-4 grid gap-3 md:grid-cols-[160px_1fr_2fr_auto]"><select name="status" className="h-10 border bg-white px-3"><option value="PASS">PASS</option><option value="FAIL">FAIL</option></select><Input name="reference" placeholder="Sandbox receipt / ticket" required /><Input name="summary" placeholder="What was submitted and what the provider returned (20+ characters)" required minLength={20} /><SubmitButton pendingLabel="Recording…">Record test</SubmitButton></form>{template.sandboxTestStatus !== "NOT_RUN" && <p className={`mt-3 text-xs ${template.sandboxTestStatus === "PASS" ? "text-emerald-700" : "text-red-700"}`}>{template.sandboxTestStatus} · {template.sandboxTestReference} · {template.sandboxTestSummary}</p>}</section>}
      {template.status === "ACTIVE" && (
        <section className="mt-6 grid gap-4 border border-amber-300 bg-amber-50 p-5 lg:grid-cols-2">
          <form action={deprecateApplicationTemplateAction.bind(null, id)} className="flex flex-wrap items-end gap-3">
            <div className="min-w-72 flex-1 space-y-2">
              <Label htmlFor="deprecation-reason">Deprecation reason</Label>
              <Input id="deprecation-reason" name="reason" required minLength={10} placeholder="Why this version must no longer start new applications" />
            </div>
            <SubmitButton variant="outline" pendingLabel="Deprecating…">Deprecate version</SubmitButton>
          </form>
          <form action={rollbackApplicationTemplateAction.bind(null, id)} className="flex items-end justify-end">
            <SubmitButton variant="outline" pendingLabel="Creating rollback…">Create rollback draft from this version</SubmitButton>
          </form>
        </section>
      )}
      {template.status === "DEPRECATED" && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border bg-white p-5">
          <p className="text-sm"><strong>Deprecated:</strong> {template.deprecatedReason}</p>
          <form action={rollbackApplicationTemplateAction.bind(null, id)}>
            <SubmitButton variant="outline" pendingLabel="Creating rollback…">Create rollback draft</SubmitButton>
          </form>
        </section>
      )}
      <section className="mt-10">
        <h2 className="text-2xl font-semibold">Field mapping</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Each row connects an agency field to a reviewed canonical value.
          Published versions are locked.
        </p>
        <div className="mt-6 space-y-3">
          {template.fields.map((field) => (
            <form
              key={field.id}
              action={updateApplicationTemplateFieldAction.bind(
                null,
                id,
                field.id,
              )}
              className="grid gap-4 border bg-white p-5 lg:grid-cols-[1.1fr_180px_1fr_1fr_auto]"
            >
              <div className="space-y-2">
                <Label htmlFor={`label-${field.id}`}>Field label</Label>
                <Input
                  id={`label-${field.id}`}
                  name="displayLabel"
                  defaultValue={field.displayLabel}
                  disabled={!editable}
                />
                <p className="text-xs text-muted-foreground">
                  {field.pdfFieldName
                    ? `PDF field: ${field.pdfFieldName}`
                    : `Key: ${field.fieldKey}`}
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`type-${field.id}`}>Type</Label>
                <select
                  id={`type-${field.id}`}
                  name="fieldType"
                  defaultValue={field.fieldType}
                  disabled={!editable}
                  className="h-9 w-full border bg-white px-3 text-sm"
                >
                  {fieldTypes.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`mapping-${field.id}`}>Canonical mapping</Label>
                <select
                  id={`mapping-${field.id}`}
                  name="canonicalFieldPath"
                  defaultValue={field.canonicalFieldPath ?? ""}
                  disabled={!editable}
                  className="h-9 w-full border bg-white px-3 text-sm"
                >
                  <option value="">Staff entry / unmapped</option>
                  {availablePaths.map((path) => (
                    <option key={path}>{path}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor={`section-${field.id}`}>Section</Label>
                <Input
                  id={`section-${field.id}`}
                  name="section"
                  defaultValue={field.section}
                  disabled={!editable}
                />
                <Input
                  name="staffGuidance"
                  aria-label={`Guidance for ${field.displayLabel}`}
                  defaultValue={field.staffGuidance ?? ""}
                  placeholder="Staff guidance"
                  disabled={!editable}
                />
                <Input
                  name="validationRules"
                  aria-label={`Validation rules for ${field.displayLabel}`}
                  defaultValue={field.validationRules ?? ""}
                  placeholder='Validation JSON, e.g. {"minLength":2}'
                  disabled={!editable}
                />
              </div>
              <div className="flex items-end gap-3">
                <label className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="required"
                    defaultChecked={field.required}
                    disabled={!editable}
                  />{" "}
                  Required
                </label>
                {editable && (
                  <SubmitButton size="sm" pendingLabel="Saving…">
                    Save
                  </SubmitButton>
                )}
              </div>
            </form>
          ))}
        </div>
      </section>
      {editable && template.templateType === "GENERATED_PDF" && (
        <section className="mt-12 border-t pt-10">
          <h2 className="text-2xl font-semibold">Add generated field</h2>
          <form
            action={addApplicationTemplateFieldAction.bind(null, id)}
            className="mt-5 grid gap-4 border bg-white p-5 sm:grid-cols-2"
          >
            <Field name="fieldKey" label="Field key" />
            <Field name="displayLabel" label="Field label" />
            <Field name="section" label="Section" />
            <div className="space-y-2">
              <Label htmlFor="new-type">Type</Label>
              <select
                id="new-type"
                name="fieldType"
                className="h-9 border bg-white px-3"
              >
                {fieldTypes.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-mapping">Canonical mapping</Label>
              <select
                id="new-mapping"
                name="canonicalFieldPath"
                className="h-9 border bg-white px-3"
              >
                <option value="">Staff entry / unmapped</option>
                {availablePaths.map((path) => (
                  <option key={path}>{path}</option>
                ))}
              </select>
            </div>
            <Field name="staffGuidance" label="Staff guidance" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="required" /> Required
            </label>
            <div>
              <SubmitButton pendingLabel="Adding…">Add field</SubmitButton>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
function Field({ name, label }: { name: string; label: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`new-${name}`}>{label}</Label>
      <Input
        id={`new-${name}`}
        name={name}
        required={name !== "staffGuidance"}
      />
    </div>
  );
}

function Gate({ label, value }: { label: string; value: string }) {
  const good = ["PASS", "APPROVED", "NOT_REQUIRED"].includes(value);
  return <div className="flex items-center justify-between border-b pb-2 last:border-b-0"><span className="text-slate-600">{label}</span><span className={good ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{value}</span></div>;
}
