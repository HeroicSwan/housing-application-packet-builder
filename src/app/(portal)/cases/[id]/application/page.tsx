import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { openApplicationDraftAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { CaseHeader } from "@/features/cases/case-header";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function CaseApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"])); const { id } = await params;
  if (!(await canAccessCase(user, id))) notFound();
  const clientCase = await db.clientCase.findUnique({ where: { id }, include: { selectedProgram: { include: { requirements: true, applicationTemplates: { where: { status: "ACTIVE" }, include: { fields: true, drafts: { where: { clientCaseId: id }, include: { fields: true } } }, orderBy: { version: "desc" } } } } } });
  if (!clientCase) notFound();
  const program = clientCase.selectedProgram;
  if (!program) return <div><CaseHeader clientCase={clientCase} /><div className="mt-10 rounded-lg border bg-white p-8 text-center"><h2 className="text-xl font-semibold">Select a housing program first</h2><p className="mt-2 text-sm text-muted-foreground">Application templates are tied to a specific program.</p><Button asChild className="mt-5"><Link href={`/cases/${id}/program`}>Choose a program <ArrowRight /></Link></Button></div></div>;
  return <div><CaseHeader clientCase={clientCase} /><section className="mt-10"><div className="border-b pb-4"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Application templates</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Prepare an actual housing application</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Reviewed information is mapped into the selected application. Staff answer only unresolved fields before generating the completed form.</p></div><div className="mt-5 space-y-4">{program.applicationTemplates.map((template) => <TemplateCard key={template.id} template={template} caseId={id} requiredDocuments={program.requirements.filter((item) => item.isRequired).length} />)}{!program.applicationTemplates.length && <div className="rounded-lg border bg-white p-8 text-center text-sm text-muted-foreground">No active application template is available for this program.</div>}</div></section></div>;
}

function TemplateCard({ template, caseId, requiredDocuments }: { template: { id: string; name: string; version: number; templateType: string; description: string; status: string; fields: { id: string }[]; drafts: { id: string; fields: { populationMethod: string; validationState: string; reviewState: string }[] }[] }; caseId: string; requiredDocuments: number }) {
  const draft = template.drafts[0];
  const automaticallyCompleted = draft?.fields.filter((field) => field.populationMethod !== "UNRESOLVED" && field.populationMethod !== "STAFF_ENTRY" && field.validationState === "VALID").length ?? 0;
  const attention = draft?.fields.filter((field) => field.validationState !== "VALID" || ["NEEDS_ANSWER", "CONFLICT", "EXPIRED", "AWAITING_CONFIRMATION"].includes(field.reviewState)).length ?? template.fields.length;
  return <article className="rounded-lg border bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-5"><div className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><FileText className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold">{template.name}</h3><StatusBadge status={template.status} /></div><p className="mt-1 text-sm text-muted-foreground">Version {template.version} · {template.templateType.replaceAll("_", " ")}</p><p className="mt-3 max-w-2xl text-sm leading-6">{template.description}</p></div></div>{draft ? <Button asChild><Link href={`/applications/${draft.id}`}>Continue application <ArrowRight /></Link></Button> : <form action={openApplicationDraftAction.bind(null, caseId, template.id)}><SubmitButton pendingLabel="Preparing…">Prepare application <ArrowRight /></SubmitButton></form>}</div><div className="mt-5 grid border-y sm:grid-cols-4 sm:divide-x"><Fact label="Application fields" value={template.fields.length} /><Fact label="Automatically completed" value={automaticallyCompleted} /><Fact label="Needs attention" value={attention} /><Fact label="Required documents" value={requiredDocuments} /></div></article>;
}
function Fact({ label, value }: { label: string; value: number }) { return <div className="flex items-center gap-3 px-4 py-3"><span className="flex-1 text-sm text-muted-foreground">{label}</span><strong className="tabular-nums">{value}</strong></div>; }
