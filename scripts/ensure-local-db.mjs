import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { resolveLocalDatabaseUrl } from "./local-database.mjs";

if ((process.env.DATA_MODE ?? "synthetic") !== "synthetic") throw new Error("Real applicant-data mode is not implemented or approved.");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running db:setup.");
const { databasePath } = resolveLocalDatabaseUrl(process.cwd(), url);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });
fs.closeSync(fs.openSync(databasePath, "a"));
