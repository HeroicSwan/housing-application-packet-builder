import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { activateOrganizationContext, canAccessCase, requireRole } from "@/lib/auth/session";
import { CaseHeader } from "@/features/cases/case-header";
import { SectionHeading } from "@/components/section-heading";
import { formatDate, statusLabel } from "@/lib/format";

export default async function AuditPage({ params }: { params: Promise<{ id: string }> }) {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER", "REVIEWER", "ADMIN"])); const { id } = await params; if (!(await canAccessCase(user, id))) notFound();
  const [clientCase, auditEvents] = await Promise.all([db.clientCase.findUnique({ where: { id } }), db.auditEvent.findMany({ where: { clientCaseId: id }, include: { user: true }, orderBy: { createdAt: "desc" } })]); if (!clientCase) notFound();
  return <div><CaseHeader clientCase={clientCase} /><section className="mt-10"><SectionHeading index="03" title="Audit history" description="Meaningful actions are recorded without document contents or sensitive field values." /><ol className="mt-6 border-l border-primary pl-8">{auditEvents.map((event) => <li key={event.id} className="relative border-t py-6"><span className="absolute -left-[37px] top-7 h-4 w-4 border-4 border-white bg-primary" /><div className="grid gap-3 sm:grid-cols-[1fr_auto]"><div><h3 className="font-semibold">{statusLabel(event.action)}</h3><p className="mt-1 text-sm text-muted-foreground">{event.metadata} · {event.user.name}</p><p className="mt-1 text-xs text-muted-foreground">{event.entityType} · {event.entityId}</p></div><time className="text-sm text-muted-foreground">{formatDate(event.createdAt)}</time></div></li>)}</ol></section></div>;
}
