import { PrismaClient } from "@prisma/client";

const databaseUrl = process.env.POSTGRES_TEST_ADMIN_URL;
if (!databaseUrl?.startsWith("postgres")) throw new Error("POSTGRES_TEST_ADMIN_URL is required.");
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

await db.$executeRawUnsafe(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hapb_ci_app') THEN
    CREATE ROLE hapb_ci_app LOGIN PASSWORD 'test-postgres-role-password';
  END IF;
END $$`);
await db.$executeRawUnsafe('GRANT CONNECT ON DATABASE hapb_test TO hapb_ci_app');
await db.$executeRawUnsafe('GRANT USAGE ON SCHEMA public, app_private TO hapb_ci_app');
await db.$executeRawUnsafe('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO hapb_ci_app');
await db.$executeRawUnsafe('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO hapb_ci_app');
await db.$executeRawUnsafe('GRANT EXECUTE ON FUNCTION app_private.current_organization_id() TO hapb_ci_app');
await db.$disconnect();
console.log("Provisioned isolated PostgreSQL CI application role.");
