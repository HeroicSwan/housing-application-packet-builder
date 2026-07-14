"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Files, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, Users } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type User = { name: string; email: string; role: string };
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };

function Navigation({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return <nav aria-label="Primary" className="space-y-1">{items.map(({ href, label, icon: Icon }) => {
    const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`${href}/`));
    return <Link key={href} href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("relative flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground", active && "bg-accent text-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary")}><Icon className="h-4 w-4" />{label}</Link>;
  })}</nav>;
}

function UserBlock({ user }: { user: User }) {
  return <div className="border-t pt-4"><div className="px-3"><div className="truncate text-sm font-medium">{user.name}</div><div className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</div><div className="mt-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{user.role.toLowerCase()}</div></div><Button asChild variant="ghost" size="sm" className="mt-3 w-full justify-start"><Link href="/account/security"><ShieldCheck /> Account security</Link></Button><form action={logoutAction}><Button variant="ghost" size="sm" className="w-full justify-start"><LogOut /> Sign out</Button></form></div>;
}

export function AppShell({ user, children }: { user: User; children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = user.role === "REVIEWER" ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/review", label: "Review queue", icon: ClipboardList }] : user.role === "ADMIN" ? [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/admin/programs", label: "Programs", icon: Files }, { href: "/admin/users", label: "Staff access", icon: Users }] : [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }, { href: "/cases", label: "Cases", icon: Files }, { href: "/review", label: "Applications & review", icon: ClipboardList }];
  return <div className="portal-shell min-h-screen bg-[#f7f8f8]">
    <div className="border-b border-sky-200/70 bg-sky-50 px-4 py-2 text-center text-xs text-sky-950"><ShieldCheck className="mr-1 inline h-3.5 w-3.5" /> Synthetic demonstration data only. Human review is required before submission.</div>
    <header className="sticky top-0 z-40 flex h-14 items-center border-b bg-white px-4 md:hidden"><Sheet open={open} onOpenChange={setOpen}><SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Open navigation" />}><Menu /></SheetTrigger><SheetContent side="left" className="w-[286px] p-0"><SheetHeader className="border-b px-5 py-5"><SheetTitle>Housing Packet Builder</SheetTitle><SheetDescription>Nonprofit case workspace</SheetDescription></SheetHeader><div className="flex flex-1 flex-col justify-between p-4"><Navigation items={links} pathname={pathname} onNavigate={() => setOpen(false)} /><UserBlock user={user} /></div></SheetContent></Sheet><Link href="/dashboard" className="ml-3 text-sm font-semibold tracking-[-0.01em]">Housing Packet Builder</Link></header>
    <div className="mx-auto grid min-h-[calc(100vh-33px)] max-w-[1600px] md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-white px-4 py-6 md:flex"><Link href="/dashboard" className="px-3 text-sm font-semibold leading-5 tracking-[-0.01em]">Housing Packet<br />Builder</Link><p className="mt-2 px-3 text-xs text-muted-foreground">Nonprofit case workspace</p><div className="mt-8"><Navigation items={links} pathname={pathname} /></div><div className="mt-auto"><UserBlock user={user} /></div></aside>
      <div className="min-w-0"><main className="mx-auto max-w-[1280px] px-4 py-7 sm:px-7 sm:py-9 lg:px-10 lg:py-11">{children}</main><footer className="mx-auto max-w-[1280px] border-t px-4 py-5 text-xs text-muted-foreground sm:px-7 lg:px-10"><div className="flex flex-wrap justify-between gap-3"><span>Housing Application Packet Builder · Demonstration</span><span><Settings className="mr-1 inline h-3.5 w-3.5" />Not for production client data</span></div></footer></div>
    </div>
  </div>;
}
