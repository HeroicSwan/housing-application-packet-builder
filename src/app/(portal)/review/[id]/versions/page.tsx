import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/format";

export default async function PacketVersionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["REVIEWER"]); const { id } = await params; const current = await db.applicationPacket.findUnique({ where: { id } }); if (!current) notFound(); const packets = await db.applicationPacket.findMany({ where: { clientCaseId: current.clientCaseId }, include: { clientCase: true }, orderBy: { version: "desc" } });
  return <div className="mx-auto max-w-4xl"><Link href={`/review/${id}`} className="text-sm font-semibold text-primary underline underline-offset-4">Back to packet review</Link><h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Packet version history</h1><p className="mt-3 text-muted-foreground">Every generated snapshot remains available for review and audit.</p><div className="mt-8 border bg-white">{packets.map((packet) => <Link href={`/packets/${packet.id}`} key={packet.id} className="grid items-center gap-4 border-b p-5 last:border-b-0 hover:bg-secondary sm:grid-cols-[100px_1fr_170px]"><div className="text-3xl font-semibold text-primary">V{packet.version}</div><div><div className="font-semibold">{packet.referenceNumber}</div><div className="text-sm text-muted-foreground">Generated {formatDate(packet.generatedAt)} · {packet.clientCase.legalName}</div></div><StatusBadge status={packet.status} /></Link>)}</div></div>;
}
