import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { createTenantDatabase } from "@/lib/tenant-database";

const globalForPrisma = globalThis as unknown as { applicationPrisma?: PrismaClient; systemPrisma?: PrismaClient };

const applicationDb = globalForPrisma.applicationPrisma ?? new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
export const systemDb = globalForPrisma.systemPrisma ?? (env.SYSTEM_DATABASE_URL ? new PrismaClient({ datasources: { db: { url: env.SYSTEM_DATABASE_URL } } }) : applicationDb);

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.applicationPrisma = applicationDb;
  globalForPrisma.systemPrisma = systemDb;
}

export const db = createTenantDatabase(applicationDb, { databaseRls: env.DATABASE_URL.startsWith("postgres") });
