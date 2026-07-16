import { createCaseAction } from "@/app/actions/cases";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { CaseForm } from "@/features/cases/case-form";

export default async function NewCasePage() {
  activateOrganizationContext(await requireRole(["CASEWORKER"]));
  return <div className="mx-auto max-w-4xl"><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">New synthetic record</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Create a client case</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Only the legal name is required. Save a partial intake now and complete it as information becomes available.</p><div className="mt-8"><CaseForm action={createCaseAction} submitLabel="Create case" /></div></div>;
}
