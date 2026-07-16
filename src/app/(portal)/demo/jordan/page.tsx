import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { activateOrganizationContext, requireRole } from "@/lib/auth/session";

export default async function JordanDemoPage() {
  const user = activateOrganizationContext(await requireRole(["CASEWORKER"]));
  const draft = await db.applicationDraft.findFirst({ where: { clientCase: { legalName: "Jordan Rivera", assignedCaseworkerId: user.id }, template: { name: "Family Pathways Housing Application" } }, orderBy: { updatedAt: "desc" } });
  if (!draft) redirect("/cases");
  redirect(`/applications/${draft.id}`);
}
