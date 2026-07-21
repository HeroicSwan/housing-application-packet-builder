import { notFound } from "next/navigation";
import { updateCaseAction, updateCustomCaseFieldsAction } from "@/app/actions/cases";
import { db } from "@/lib/db";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { CaseHeader } from "@/features/cases/case-header";
import { CaseForm } from "@/features/cases/case-form";
import { SectionHeading } from "@/components/section-heading";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const { id } = await params;
  if (!(await canAccessCase(user, id))) notFound();
  const [clientCase, definitions] = await Promise.all([
    db.clientCase.findUnique({ where: { id }, include: { customFieldValues: true } }),
    db.agencyFieldDefinition.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { key: "asc" } }),
  ]);
  if (!clientCase) notFound();
  const customValues = new Map(clientCase.customFieldValues.map((value) => [value.definitionId, value.value ?? ""]));
  return <div><CaseHeader clientCase={clientCase} /><div className="mt-10"><SectionHeading index="03" title="Client information" description="Keep the live case record aligned with reviewed supporting documents. Submitted packet versions remain unchanged." /><div className="mt-5"><CaseForm action={updateCaseAction.bind(null, id)} submitLabel="Save changes" initialValues={{ ...clientCase, dateOfBirth: clientCase.dateOfBirth?.toISOString().slice(0, 10) ?? "" }} /></div></div>{definitions.length > 0 && <section className="mt-12"><SectionHeading index="04" title="Agency-specific information" description="These fields are configured by your organization and remain private to its cases." /><form action={updateCustomCaseFieldsAction.bind(null, id)} className="mt-5 grid gap-5 border bg-white p-6 sm:grid-cols-2">{definitions.map((definition) => <div key={definition.id} className="space-y-2"><label htmlFor={`custom-${definition.key}`} className="text-sm font-medium">{definition.label}{definition.required ? " *" : ""}</label><CustomFieldInput definition={definition} value={customValues.get(definition.id) ?? ""} />{definition.helpText && <p className="text-xs text-muted-foreground">{definition.helpText}</p>}</div>)}<div className="sm:col-span-2"><button type="submit" className="border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Save agency-specific fields</button></div></form></section>}</div>;
}

type FieldDefinition = { key: string; fieldType: string; required: boolean; optionsJson: string | null };
function CustomFieldInput({ definition, value }: { definition: FieldDefinition; value: string }) {
  const common = { id: `custom-${definition.key}`, name: `custom_${definition.key}`, required: definition.required, className: "h-10 w-full border bg-white px-3 text-sm", defaultValue: value };
  if (definition.fieldType === "LONG_TEXT") return <textarea {...common} className="min-h-24 w-full border bg-white px-3 py-2 text-sm" />;
  if (definition.fieldType === "BOOLEAN") return <label className="flex h-10 items-center gap-2 text-sm"><input id={common.id} name={common.name} type="checkbox" value="true" defaultChecked={value === "true"} /> Yes</label>;
  if (definition.fieldType === "SELECT" || definition.fieldType === "MULTI_SELECT") {
    let options: string[] = [];
    try { const parsed = JSON.parse(definition.optionsJson ?? "[]"); options = Array.isArray(parsed) ? parsed.filter((option): option is string => typeof option === "string") : []; } catch { options = []; }
    return <select {...common} multiple={definition.fieldType === "MULTI_SELECT"} name={common.name} defaultValue={definition.fieldType === "MULTI_SELECT" ? value.split("|").filter(Boolean) : value}><option value="">Select…</option>{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  }
  return <input {...common} type={definition.fieldType === "DATE" ? "date" : definition.fieldType === "NUMBER" || definition.fieldType === "CURRENCY" ? "number" : "text"} />;
}
