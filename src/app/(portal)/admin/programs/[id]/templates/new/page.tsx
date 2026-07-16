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
  activateOrganizationContext(await requireRole(["ADMIN"])); const { id } = await params; const program = await db.housingProgram.findUnique({ where: { id } }); if (!program) notFound();
  return <div className="mx-auto max-w-3xl"><Link href={`/admin/programs/${id}`} className="text-sm text-primary underline underline-offset-4">Back to program</Link><p className="mt-10 text-xs font-semibold uppercase tracking-[0.08em] text-primary">Application template</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Create a template for {program.name}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Upload an agency AcroForm PDF to discover its real fields, or create a generated application and add fields manually.</p><form action={createApplicationTemplateAction.bind(null, id)} className="mt-8 grid gap-5 border bg-white p-6"><Field name="name" label="Template name" required /><div className="space-y-2"><Label htmlFor="templateType">Output type</Label><select id="templateType" name="templateType" className="h-10 border bg-white px-3"><option value="ACROFORM">Agency fillable PDF</option><option value="GENERATED_PDF">Generated application PDF</option></select></div><div className="space-y-2"><Label htmlFor="file">Agency PDF</Label><Input id="file" name="file" type="file" accept="application/pdf,.pdf" /><p className="text-xs text-muted-foreground">Required only for an agency fillable PDF.</p></div><Field name="outputFilenamePattern" label="Output filename pattern" defaultValue="{clientName}-application-v{version}.pdf" required /><div className="space-y-2"><Label htmlFor="description">Description</Label><Textarea id="description" name="description" required /></div><SubmitButton pendingLabel="Inspecting template…">Create and inspect template</SubmitButton></form></div>;
}
function Field({ name, label, required, defaultValue }: { name: string; label: string; required?: boolean; defaultValue?: string }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} required={required} defaultValue={defaultValue} /></div>; }
