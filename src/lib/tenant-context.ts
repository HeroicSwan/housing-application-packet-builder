import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

const organizationContext = new AsyncLocalStorage<string>();

export function enterOrganizationContext(organizationId: string) {
  organizationContext.enterWith(organizationId);
}

export function runWithOrganization<T>(organizationId: string, callback: () => T | Promise<T>) {
  return organizationContext.run(organizationId, async () => await callback());
}

export function requireOrganizationContext() {
  const organizationId = organizationContext.getStore();
  if (!organizationId) throw new Error("Organization context is required for tenant-scoped database access.");
  return organizationId;
}
