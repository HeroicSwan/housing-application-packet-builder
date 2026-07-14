"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [["", "Overview"], ["/client", "Client profile"], ["/household", "Household"], ["/documents", "Source documents"], ["/program", "Program"], ["/application", "Application"], ["/requirements", "Requirements"], ["/packet", "Review summary"], ["/audit", "History"]];

export function CaseNav({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  return <nav aria-label="Case sections" className="mt-6 flex gap-1 overflow-x-auto border-b pb-px">{items.map(([path, label]) => { const href = `/cases/${caseId}${path}`; const active = pathname === href; return <Link aria-current={active ? "page" : undefined} className={cn("shrink-0 border-b-2 border-transparent px-3 py-2.5 text-sm font-medium text-muted-foreground transition-[color,border-color] duration-150 hover:text-foreground", active && "border-primary text-foreground")} key={path} href={href}>{label}</Link>; })}</nav>;
}
