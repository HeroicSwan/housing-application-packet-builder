import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

if ((process.env.DATA_MODE ?? "synthetic") !== "synthetic") throw new Error("Local SQLite tooling only runs in the synthetic profile. Production deployments use PostgreSQL, start blank, and are claimed once through /setup (see docs/production-operations.md).");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running db:setup.");
const { databasePath } = resolveLocalDatabaseUrl(process.cwd(), url);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.closeSync(fs.openSync(databasePath, "a"));
