import { CaseNav } from "@/components/case-nav";
import { StatusBadge } from "@/components/status-badge";

export function CaseHeader({ clientCase }: { clientCase: { id: string; referenceNumber: string; preferredName: string | null; legalName: string; status: string } }) {
  return <><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{clientCase.referenceNumber}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{clientCase.preferredName ?? clientCase.legalName}</h1><p className="mt-1.5 text-sm text-muted-foreground">Legal name: {clientCase.legalName}</p></div><StatusBadge status={clientCase.status} /></div><CaseNav caseId={clientCase.id} /></>;
}
