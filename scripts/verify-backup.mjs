import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs/promises";

const filename = process.argv[2]; if (!filename) throw new Error("Pass the path to a local encrypted backup."); const input = await fs.readFile(filename); if (input.subarray(0, 5).toString() !== "HAPB1") throw new Error("Backup envelope is invalid.");
const key = process.env.DATA_ENCRYPTION_KEY ? Buffer.from(process.env.DATA_ENCRYPTION_KEY, "base64") : crypto.createHash("sha256").update(process.env.SESSION_SECRET ?? "").digest(); const iv = input.subarray(5, 17); const tag = input.subarray(input.length - 16); const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv); decipher.setAuthTag(tag); const plain = Buffer.concat([decipher.update(input.subarray(17, input.length - 16)), decipher.final()]); if (plain.subarray(0, 16).toString() !== "SQLite format 3\0") throw new Error("Decrypted backup is not a valid SQLite database."); console.log(JSON.stringify({ valid: true, checksum: crypto.createHash("sha256").update(plain).digest("hex"), bytes: plain.length }));
