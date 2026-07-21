import Link from "next/link";
import { Files, Settings, ShieldCheck, Users, SlidersHorizontal } from "lucide-react";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";
import { db } from "@/lib/db";

export default async function AdminPage() {
  const admin = activateOrganizationContext(await requireRole(["ADMIN"]));
  const [organization, programs, users] = await Promise.all([db.organization.findUniqueOrThrow({ where: { id: admin.organizationId } }), db.housingProgram.count(), db.user.count({ where: { isActive: true } })]);
  const cards = [
    { href: "/admin/setup", title: "Organization setup", detail: organization.setupStatus === "COMPLETED" ? "Active configuration · reopen explicitly to edit" : `In progress · resume ${organization.setupCurrentStep}`, icon: Settings },
    { href: "/admin/programs", title: "Programs & templates", detail: `${programs} configured housing program${programs === 1 ? "" : "s"}`, icon: Files },
    { href: "/admin/users", title: "Staff access", detail: `${users} active staff account${users === 1 ? "" : "s"}`, icon: Users },
    { href: "/admin/data-governance", title: "Data governance", detail: "Retention, legal holds, exports, and deletion", icon: ShieldCheck },
    { href: "/admin/agency-configuration", title: "Agency configuration", detail: "Custom fields, workflows, and document profiles", icon: SlidersHorizontal },
  ];
  return <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">Administration</p><h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Operate {organization.name}</h1><p className="mt-2 max-w-3xl text-muted-foreground">Configure access, integrations, program forms, and lifecycle controls without exposing stored credentials.</p><div className="mt-8 grid gap-4 sm:grid-cols-2">{cards.map(({ href, title, detail, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border bg-white p-5 shadow-[0_8px_30px_rgba(21,38,59,0.045)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_40px_rgba(21,38,59,0.08)]"><Icon className="h-5 w-5 text-primary" /><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{detail}</p></Link>)}</div></div>;
}
