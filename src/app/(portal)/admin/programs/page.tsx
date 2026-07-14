import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export default async function ProgramsPage() {
  await requireRole(["ADMIN"]);
  const programs = await db.housingProgram.findMany({ include: { requirements: true, _count: { select: { cases: true } } }, orderBy: { name: "asc" } });
  return <div><div className="flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">Administration</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">Housing programs</h1><p className="mt-2 text-sm text-muted-foreground">All organizations in this demonstration are fictional.</p></div><Button asChild><Link href="/admin/programs/new"><Plus /> Create program</Link></Button></div><div className="mt-8 divide-y border-y">{programs.map((program) => <Link data-row-link href={`/admin/programs/${program.id}`} key={program.id} className="grid items-center gap-4 rounded-md px-3 py-4 md:grid-cols-[1fr_1fr_130px_110px_auto]"><div><div className="font-medium">{program.name}</div><div className="mt-0.5 text-sm text-muted-foreground">{program.organization}</div></div><div className="text-sm text-muted-foreground">{program.description}</div><div className="text-sm">{program.requirements.length} requirements</div><div className="text-sm">{program._count.cases} cases</div><ArrowRight className="h-4 w-4" /></Link>)}</div></div>;
}
