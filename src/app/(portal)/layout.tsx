import { AppShell } from "@/components/app-shell";
import { activateOrganizationContext, requireUser } from "@/lib/auth/session";
import { env } from "@/lib/env";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = activateOrganizationContext(await requireUser({ allowMfaEnrollment: true }));
  return <AppShell user={user} dataMode={env.DATA_MODE}>{children}</AppShell>;
}
