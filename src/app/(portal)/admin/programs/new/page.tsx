import { createProgramAction } from "@/app/actions/admin";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default async function NewProgramPage() {
  activateOrganizationContext(await requireRole(["ADMIN"]));
  return <div className="mx-auto max-w-3xl"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Administration</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Create a fictional program</h1><form action={createProgramAction} className="mt-8 space-y-5 rounded-lg border bg-white p-5 sm:p-7"><Field name="name" label="Program name" required /><Field name="organization" label="Organization" required /><Area name="description" label="Description" required /><Area name="incomeLimitNotes" label="Income limit notes" /><Area name="householdRestrictions" label="Household restrictions" /><Area name="accessibilityNotes" label="Accessibility notes" /><Area name="contactInformation" label="Contact information" /><SubmitButton pendingLabel="Creating program…">Create program</SubmitButton></form></div>;
}
function Field({ name, label, required = false }: { name: string; label: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} required={required} /></div>; }
function Area({ name, label, required = false }: { name: string; label: string; required?: boolean }) { return <div className="space-y-2"><Label htmlFor={name}>{label}</Label><Textarea id={name} name={name} required={required} /></div>; }
