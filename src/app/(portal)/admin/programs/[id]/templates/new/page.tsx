import Link from "next/link";
import { notFound } from "next/navigation";
import { createApplicationTemplateAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function NewTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  activateOrganizationContext(await requireRole(["ADMIN"]));
  const { id } = await params;
  const program = await db.housingProgram.findUnique({ where: { id } });
  if (!program) notFound();
  return <div className="mx-auto max-w-3xl"><Link href={`/admin/programs/${id}`} className="text-sm text-primary underline underline-offset-4">Back to program</Link><p className="mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-primary">Bring your own form</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Create a template for {program.name}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Your organization supplies the PDF. Upload your own fillable agency form, let the builder discover its fields, then map and validate them in the next step. Nothing is bundled or shared between organizations.</p><div className="mt-6 grid gap-3 border bg-slate-50 p-4 text-xs text-slate-700 sm:grid-cols-3"><div><strong>1. Upload</strong><span className="mt-1 block">Choose your agency’s PDF.</span></div><div><strong>2. Map</strong><span className="mt-1 block">Connect fields to reviewed data.</span></div><div><strong>3. Publish</strong><span className="mt-1 block">Run your own QA and acceptance checks.</span></div></div><form action={createApplicationTemplateAction.bind(null, id)} className="mt-8 grid gap-5 border bg-white p-6"><Field name="name" label="Template name" required /><div className="space-y-2"><Label htmlFor="templateType">Output type</Label><select id="templateType" name="templateType" className="h-10 border bg-white px-3"><option value="ACROFORM">Agency fillable PDF</option><option value="GENERATED_PDF">Generated PDF</option></select></div><div className="space-y-2"><Label htmlFor="file">Your agency PDF</Label><Input id="file" name="file" type="file" accept="application/pdf,.pdf" /><p className="text-xs text-muted-foreground">Required for an agency fillable PDF. The uploaded file is stored in your organization’s private storage.</p></div><label className="flex items-start gap-3 border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" name="requiresAgencyAcceptance" className="mt-1" /><span><strong>Use for real agency deployment</strong><span className="mt-1 block text-xs text-amber-950/80">Adds gates for your signed acceptance record and sandbox submission evidence before publication. Leave unchecked for internal/synthetic QA.</span></span></label><Field name="outputFilenamePattern" label="Output filename pattern" defaultValue="{clientName}-application-v{version}.pdf" required /><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" required /></div><SubmitButton pendingLabel="Inspecting template…">Upload and inspect my PDF</SubmitButton></form></div>;
}

function Field({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} required={required} defaultValue={defaultValue} /></div>; }
