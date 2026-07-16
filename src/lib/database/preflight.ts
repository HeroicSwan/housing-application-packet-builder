import "server-only";
import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { timedConnectionTest, type ConnectionTestResult } from "@/lib/setup/connection-tests/types";

type RoleRow = { current_user: string; rolsuper: boolean; rolbypassrls: boolean; rolcreatedb: boolean; rolcreaterole: boolean };

export function testDatabasePermissions(): Promise<ConnectionTestResult> {
  return timedConnectionTest(async () => {
    if (!env.DATABASE_URL.startsWith("postgres") || !env.SYSTEM_DATABASE_URL) return { status: "SIMULATED", code: "DATABASE_SQLITE_DEMO", summary: "SQLite is valid only for the synthetic local demo; production PostgreSQL permissions were not tested." };
    const app = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
    const system = new PrismaClient({ datasources: { db: { url: env.SYSTEM_DATABASE_URL } } });
    try {
      const [appRole] = await app.$queryRaw<RoleRow[]>`SELECT current_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
      const [systemRole] = await system.$queryRaw<RoleRow[]>`SELECT current_user, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole FROM pg_roles WHERE rolname = current_user`;
      if (!appRole || !systemRole || appRole.current_user === systemRole.current_user) return { status: "FAILED", code: "DATABASE_ROLES_NOT_SEPARATE", summary: "Application and system database connections must use different roles." };
      if ([appRole, systemRole].some((role) => role.rolsuper || role.rolcreatedb || role.rolcreaterole) || appRole.rolbypassrls) return { status: "FAILED", code: "DATABASE_ROLE_OVERPRIVILEGED", summary: "A runtime database role has prohibited administrative privileges." };
      const [rls] = await system.$queryRaw<{ missing: bigint }[]>`SELECT count(*) AS missing FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity) AND c.relname NOT IN ('RateLimitBucket')`;
      if (Number(rls?.missing ?? 1) > 0) return { status: "FAILED", code: "DATABASE_RLS_INCOMPLETE", summary: "One or more tenant tables are missing forced row-level security." };
      return { status: "PASSED", code: "DATABASE_PERMISSIONS_OK", summary: "Distinct least-privilege roles and forced tenant isolation were verified." };
    } catch {
      return { status: "FAILED", code: "DATABASE_PERMISSION_TEST_FAILED", summary: "Database roles or row-level security could not be verified." };
    } finally {
      await Promise.allSettled([app.$disconnect(), system.$disconnect()]);
    }
  });
}
