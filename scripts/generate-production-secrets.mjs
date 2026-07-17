import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const outputIndex = args.indexOf("--output");
const output = outputIndex >= 0 ? args[outputIndex + 1] : undefined;
const force = args.includes("--force");

if (!output || !path.isAbsolute(output)) {
  throw new Error("Usage: npm run secrets:generate -- --output <absolute path outside the repository> [--force]");
}

const repositoryRoot = path.resolve(process.cwd());
const relativeOutput = path.relative(repositoryRoot, path.resolve(output));
if (relativeOutput && !relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput)) {
  throw new Error("Refusing to write production secrets inside the repository. Use an approved secret-manager path.");
}

const target = path.resolve(output);
if (!force) {
  try {
    await fs.access(target);
    throw new Error(`Refusing to overwrite existing secret bundle: ${target}. Use --force only after an approved rotation window.`);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

const base64 = (bytes) => crypto.randomBytes(bytes).toString("base64");
const token = () => crypto.randomBytes(48).toString("base64url");
const keyId = `rotation-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${crypto.randomBytes(4).toString("hex")}`;
const bundle = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  purpose: "Housing Application Packet Builder production application secrets",
  secrets: {
    SESSION_SECRET: token(),
    MONITORING_TOKEN: token(),
    DATA_ENCRYPTION_KEY: base64(32),
    DATA_ENCRYPTION_KEY_ID: keyId,
  },
};

await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, `${JSON.stringify(bundle, null, 2)}\n`, { mode: 0o600, flag: force ? "w" : "wx" });
try { await fs.chmod(target, 0o600); } catch { /* Windows ACLs are managed by the secret-store path. */ }
console.log(JSON.stringify({ event: "production_secret_bundle_generated", output: target, keyId, secretNames: Object.keys(bundle.secrets), valuesPrinted: false }));
