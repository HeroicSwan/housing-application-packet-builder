import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { countApplicationRows } from "./application-data.mjs";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

// Blank installations are claimed once through /setup, and the claim only succeeds against an
// empty database. This check tells scripts/setup.mjs whether that claim can work.
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing.");
resolveLocalDatabaseUrl(process.cwd(), process.env.DATABASE_URL);

const db = new PrismaClient();
const [users, organizations, applicationRows] = await Promise.all([
  db.user.count(),
  db.organization.count(),
  countApplicationRows(db),
]);
await db.$disconnect();

console.log(users + organizations + applicationRows > 0 ? "HAS_DATA" : "EMPTY");
