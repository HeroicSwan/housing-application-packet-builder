import Link from "next/link";
import { ArrowRight, CheckCircle2, CircleAlert, Clock3, FileText } from "lucide-react";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { statusLabel, formatDate } from "@/lib/format";
import { StatusBadge } from "@/components/status-badge";
import { SectionHeading } from "@/components/section-heading";
import { Button } from "@/components/ui/button";

function WorkItem({ value, label, icon: Icon, tone = "neutral" }: { value: number; label: string; icon: typeof FileText; tone?: "neutral" | "attention" | "success" }) {
  const colors = tone === "attention" ? "bg-amber-50 text-amber-800" : tone === "success" ? "bg-emerald-50 text-emerald-800" : "bg-accent text-accent-foreground";
  return <div className="flex items-center gap-3 py-3"><span className={`flex h-8 w-8 items-center justify-center rounded-md ${colors}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</div><strong className="text-lg font-semibold tabular-nums">{value}</strong></div>;
}

function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">{eyebrow}</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>{eyebrow === "Caseworker workspace" && <Link href="/demo/jordan" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary underline underline-offset-4">Continue Jordan Rivera application <ArrowRight className="h-4 w-4" /></Link>}</div>{action}</div>;
}

export default async function DashboardPage() {
  const user = await requireUser();
  if (user.role === "REVIEWER") {
    const [awaiting, conflicts, approved, packets] = await Promise.all([
      db.applicationPacket.count({ where: { status: "READY_FOR_REVIEW" } }), db.applicationPacket.count({ where: { unresolvedConflicts: { gt: 0 } } }), db.applicationPacket.count({ where: { status: "APPROVED" } }),
      db.applicationPacket.findMany({ where: { status: { in: ["READY_FOR_REVIEW", "NEEDS_CORRECTION"] } }, include: { clientCase: true, housingProgram: true }, orderBy: { generatedAt: "desc" }, take: 5 }),
    ]);
    return <div><PageIntro eyebrow="Reviewer workspace" title="Human review queue" description="Confirm every field, source, and exception before a packet moves forward." action={<Button asChild><Link href="/review">Open review queue <ArrowRight /></Link></Button>} /><div className="mt-9 grid border-y sm:grid-cols-3 sm:divide-x"><div className="px-4"><WorkItem value={awaiting} label="Awaiting review" icon={Clock3} /></div><div className="px-4"><WorkItem value={conflicts} label="Unresolved conflicts" icon={CircleAlert} tone="attention" /></div><div className="px-4"><WorkItem value={approved} label="Approved packets" icon={CheckCircle2} tone="success" /></div></div><section className="mt-10"><SectionHeading title="Priority packets" description="Most recently submitted or returned." /><div className="mt-2 divide-y">{packets.map((packet) => <Link data-row-link key={packet.id} href={`/review/${packet.id}`} className="grid items-center gap-3 rounded-md px-3 py-4 sm:grid-cols-[1fr_1fr_auto]"><div><div className="font-medium">{packet.clientCase.preferredName ?? packet.clientCase.legalName}</div><div className="mt-0.5 text-xs text-muted-foreground">{packet.referenceNumber}</div></div><div className="text-sm"><div>{packet.housingProgram.name}</div><div className="mt-0.5 text-xs text-muted-foreground">Generated {formatDate(packet.generatedAt)}</div></div><StatusBadge status={packet.status} /></Link>)}</div></section></div>;
  }
  if (user.role === "ADMIN") {
    const [programs, requirements, activity] = await Promise.all([db.housingProgram.count({ where: { isActive: true } }), db.programRequirement.count(), db.auditEvent.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 6 })]);
    return <div><PageIntro eyebrow="Administrator workspace" title="Program operations" description="Maintain fictional demonstration programs, requirements, and local accounts." /><div className="mt-9 grid border-y sm:grid-cols-3 sm:divide-x"><div className="px-4"><WorkItem value={programs} label="Active programs" icon={FileText} /></div><div className="px-4"><WorkItem value={requirements} label="Program requirements" icon={CheckCircle2} /></div><div className="px-4"><WorkItem value={activity.length} label="Recent events shown" icon={Clock3} /></div></div><section className="mt-10"><SectionHeading title="Recent system activity" /><div className="mt-2 divide-y">{activity.map((event) => <div key={event.id} className="grid gap-2 px-3 py-4 sm:grid-cols-[1fr_auto]"><div><span className="font-medium">{statusLabel(event.action)}</span><span className="text-muted-foreground"> · {event.user.name}</span></div><time className="text-sm text-muted-foreground">{formatDate(event.createdAt)}</time></div>)}</div></section></div>;
  }
  const [open, missing, awaiting, returned, cases] = await Promise.all([
    db.clientCase.count({ where: { assignedCaseworkerId: user.id, status: { notIn: ["APPROVED", "ARCHIVED"] } } }),
    db.clientCase.count({ where: { assignedCaseworkerId: user.id, documents: { none: {} } } }),
    db.applicationPacket.count({ where: { clientCase: { assignedCaseworkerId: user.id }, status: "READY_FOR_REVIEW" } }),
    db.applicationPacket.count({ where: { clientCase: { assignedCaseworkerId: user.id }, status: "NEEDS_CORRECTION" } }),
    db.clientCase.findMany({ where: { assignedCaseworkerId: user.id }, include: { documents: true, selectedProgram: true }, orderBy: { updatedAt: "desc" }, take: 6 }),
  ]);
  return <div><PageIntro eyebrow="Caseworker workspace" title={`Good morning, ${user.name.split(" ")[0]}`} description="Move cases from intake to complete, reviewable packets." action={<Button asChild><Link href="/cases/new">Create a case <ArrowRight /></Link></Button>} /><div className="mt-9 grid border-y sm:grid-cols-2 lg:grid-cols-4 sm:[&>*:nth-child(even)]:border-l lg:[&>*]:border-l lg:[&>*:first-child]:border-l-0"><div className="px-4"><WorkItem value={open} label="Assigned open cases" icon={FileText} /></div><div className="px-4"><WorkItem value={missing} label="Without documents" icon={CircleAlert} tone="attention" /></div><div className="px-4"><WorkItem value={awaiting} label="Awaiting review" icon={Clock3} /></div><div className="px-4"><WorkItem value={returned} label="Returned for correction" icon={CircleAlert} tone="attention" /></div></div><section className="mt-10"><SectionHeading title="Recently updated cases" description="Your most recent synthetic client records." action={<Button asChild variant="outline"><Link href="/cases">View all cases</Link></Button>} /><div className="mt-2"><div className="hidden grid-cols-[120px_1fr_1fr_140px_90px] border-b px-3 py-2.5 text-xs font-medium text-muted-foreground md:grid"><div>Reference</div><div>Client</div><div>Program</div><div>Status</div><div>Documents</div></div><div className="divide-y">{cases.map((clientCase) => <Link data-row-link key={clientCase.id} href={`/cases/${clientCase.id}`} className="grid gap-3 rounded-md px-3 py-4 md:grid-cols-[120px_1fr_1fr_140px_90px]"><div className="text-sm font-medium text-primary">{clientCase.referenceNumber}</div><div className="font-medium">{clientCase.preferredName ?? clientCase.legalName}</div><div className="text-sm text-muted-foreground">{clientCase.selectedProgram?.name ?? "No program selected"}</div><div><StatusBadge status={clientCase.status} /></div><div className="text-sm tabular-nums">{clientCase.documents.length}</div></Link>)}</div></div></section></div>;
}
