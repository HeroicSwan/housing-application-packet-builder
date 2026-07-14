import fs from "node:fs";
import path from "node:path";

if (!process.env.DATABASE_URL && fs.existsSync(path.resolve(process.cwd(), ".env"))) process.loadEnvFile(path.resolve(process.cwd(), ".env"));
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing. Copy .env.example to .env before running db:setup.");
if (url.startsWith("file:")) {
  const value = url.slice(5);
  const databasePath = path.isAbsolute(value) ? value : path.resolve(process.cwd(), "prisma", value);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.closeSync(fs.openSync(databasePath, "a"));
}
