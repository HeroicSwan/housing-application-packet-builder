import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { answerApplicationFieldAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function RemainingQuestionsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"])); const { id } = await params;
  const draft = await db.applicationDraft.findUnique({ where: { id }, include: { clientCase: true, template: true, fields: { include: { templateField: true }, orderBy: { templateField: { displayOrder: "asc" } } } } });
  if (!draft || !(await canAccessCase(user, draft.clientCaseId))) notFound();
  const unresolved = draft.fields.filter((field) => ["NEEDS_ANSWER", "CONFLICT", "EXPIRED", "AWAITING_CONFIRMATION"].includes(field.reviewState) || ["MISSING", "INVALID", "CONFLICT", "EXPIRED"].includes(field.validationState));
  const field = unresolved[0];
  if (!field) return <div className="mx-auto max-w-2xl"><Link href={`/applications/${id}`} className="text-sm font-medium text-primary underline underline-offset-4">Back to application</Link><div className="mt-8 rounded-lg border bg-white p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-700" /><h1 className="mt-4 text-2xl font-semibold">Remaining questions are complete</h1><p className="mt-2 text-sm text-muted-foreground">All required fields are ready for application generation.</p><Button asChild className="mt-6"><Link href={`/applications/${id}/preview`}>Review full application <ArrowRight /></Link></Button></div></div>;
  const options = field.templateField.optionsJson ? JSON.parse(field.templateField.optionsJson) as string[] : [];
  return <div className="mx-auto max-w-3xl"><Link href={`/applications/${id}`} className="inline-flex items-center gap-2 text-sm font-medium text-primary underline underline-offset-4"><ArrowLeft className="h-4 w-4" />Back to Prepare application</Link><div className="mt-7 flex items-end justify-between border-b pb-5"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Complete remaining questions</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{field.templateField.displayLabel}</h1></div><p className="text-sm tabular-nums text-muted-foreground">{draft.fields.length - unresolved.length + 1} of {draft.fields.length}</p></div>
    <div className="mt-7 rounded-lg border bg-white p-5 sm:p-7"><div className="flex flex-wrap gap-2"><StatusBadge status={field.reviewState} /><StatusBadge status={field.validationState} /></div><p className="mt-5 text-sm leading-6">{field.templateField.staffGuidance ?? "This information is required by the selected application template."}</p>{field.reviewState === "CONFLICT" && <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-medium text-amber-950">Different values were found</p><div className="mt-2 space-y-1 text-sm text-amber-900">{field.proposedValue?.split(" | ").map((value) => <p key={value}>{value}</p>)}</div><p className="mt-2 text-xs text-amber-800">{field.sourceReference}</p></div>}{field.reviewState === "EXPIRED" && <div className="mt-5 rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{field.sourceReference}</div>}
      <form action={answerApplicationFieldAction.bind(null, id, field.id)} className="mt-6 space-y-5"><QuestionControl type={field.templateField.fieldType} label={field.templateField.displayLabel} options={options} proposed={field.reviewState === "CONFLICT" ? "" : field.proposedValue ?? ""} /><div className="space-y-2"><label htmlFor="note" className="text-sm font-medium">Staff note <span className="font-normal text-muted-foreground">(optional)</span></label><Textarea id="note" name="note" placeholder="Add context for reviewers when useful." /></div><div className="flex justify-end"><SubmitButton pendingLabel="Saving answer…">Save and continue <ArrowRight /></SubmitButton></div></form>
    </div><p className="mt-4 text-center text-sm text-muted-foreground">{unresolved.length} question{unresolved.length === 1 ? "" : "s"} remaining, including this one.</p></div>;
}

function QuestionControl({ type, label, options, proposed }: { type: string; label: string; options: string[]; proposed: string }) {
  if (type === "BOOLEAN") return <label className="flex items-start gap-3 rounded-md border p-4 text-sm"><input type="checkbox" name="value" className="mt-0.5 h-4 w-4 accent-[#244b6b]" /><span><strong>Yes, confirmed</strong><span className="mt-1 block text-muted-foreground">Record the applicant&apos;s affirmative confirmation.</span></span></label>;
  if (type === "SINGLE_SELECT") return <div className="space-y-2"><label htmlFor="value" className="text-sm font-medium">{label}</label><select id="value" name="value" required className="h-10 w-full rounded-md border bg-white px-3 text-sm"><option value="">Select an answer</option>{options.map((option) => <option key={option}>{option}</option>)}</select></div>;
  if (type === "MULTILINE_TEXT") return <div className="space-y-2"><label htmlFor="value" className="text-sm font-medium">{label}</label><Textarea id="value" name="value" defaultValue={proposed} required /></div>;
  return <div className="space-y-2"><label htmlFor="value" className="text-sm font-medium">{label}</label><Input id="value" name="value" defaultValue={proposed} type={type === "DATE" ? "date" : "text"} required /></div>;
}
