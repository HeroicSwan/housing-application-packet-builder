import { notFound } from "next/navigation";
import { updateCaseAction } from "@/app/actions/cases";
import { db } from "@/lib/db";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { CaseHeader } from "@/features/cases/case-header";
import { CaseForm } from "@/features/cases/case-form";
import { SectionHeading } from "@/components/section-heading";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"])); const { id } = await params; if (!(await canAccessCase(user, id))) notFound(); const clientCase = await db.clientCase.findUnique({ where: { id } }); if (!clientCase) notFound();
  const action = updateCaseAction.bind(null, id);
  return <div><CaseHeader clientCase={clientCase} /><div className="mt-10"><SectionHeading index="03" title="Client information" description="Keep the live case record aligned with reviewed supporting documents. Submitted packet versions remain unchanged." /><div className="mt-5"><CaseForm action={action} submitLabel="Save changes" initialValues={{ ...clientCase, dateOfBirth: clientCase.dateOfBirth?.toISOString().slice(0, 10) ?? "" }} /></div></div></div>;
}
