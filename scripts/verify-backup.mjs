import "dotenv/config";
import fs from "node:fs/promises";
import { decryptBackup } from "./backup-envelope.mjs";

const filename = process.argv[2];
if (!filename) throw new Error("Pass the path to a local encrypted backup.");
const { plain, header } = decryptBackup(await fs.readFile(filename));
if (header.kind === "sqlite" && plain.subarray(0, 16).toString() !== "SQLite format 3\0") throw new Error("Decrypted backup is not a valid SQLite database.");
if (header.kind === "postgresql" && plain.subarray(0, 5).toString() !== "PGDMP") throw new Error("Decrypted backup is not a valid PostgreSQL custom dump.");
console.log(JSON.stringify({ valid: true, database: header.kind, checksum: header.checksum, bytes: plain.length, createdAt: header.createdAt }));
