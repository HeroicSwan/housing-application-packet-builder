import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

if ((process.env.DATA_MODE ?? "synthetic") !== "synthetic") throw new Error("Real applicant-data mode is not implemented or approved.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running db:setup.");
resolveLocalDatabaseUrl(process.cwd(), process.env.DATABASE_URL);

const db = new PrismaClient();
const [users, cases, programs, auditEvents, backups] = await Promise.all([
  db.user.count(),
  db.clientCase.count(),
  db.housingProgram.count(),
  db.auditEvent.count(),
  db.backupRun.count(),
]);

if (users + cases + programs + auditEvents + backups > 0) {
  const organization = await db.organization.upsert({
    where: { slug: "synthetic-housing-demo" },
    update: {},
    create: { id: "synthetic-demo-organization", slug: "synthetic-housing-demo", name: "Synthetic Housing Demonstration" },
  });
  await db.$transaction([
    db.user.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    db.clientCase.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    db.housingProgram.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
    db.auditEvent.updateMany({ where: { organizationId: null }, data: { organizationId: organization.id } }),
  ]);
  const sessions = await db.authSession.findMany({ where: { organizationId: null }, select: { id: true, user: { select: { organizationId: true } } } });
  for (const session of sessions) {
    if (session.user.organizationId) await db.authSession.update({ where: { id: session.id }, data: { organizationId: session.user.organizationId } });
  }
  console.log("Existing synthetic records were assigned to the local demonstration organization.");
}

await db.$disconnect();
