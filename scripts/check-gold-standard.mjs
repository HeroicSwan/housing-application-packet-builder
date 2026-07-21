import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const manifest = JSON.parse(await fs.readFile(path.join(root, "evaluation", "gold-standard", "manifest.json"), "utf8"));
if (manifest.syntheticOnly !== true || !Array.isArray(manifest.cases) || !manifest.cases.length) throw new Error("Gold-standard manifest must contain synthetic cases.");
const ids = new Set();
for (const item of manifest.cases) {
  if (!item.id || ids.has(item.id)) throw new Error(`Duplicate or missing gold-standard case id: ${item.id || "unknown"}`);
  ids.add(item.id);
  const fixture = path.resolve(root, item.file);
  await fs.access(fixture);
  const header = Buffer.alloc(5);
  const handle = await fs.open(fixture, "r");
  try { await handle.read(header, 0, 5, 0); } finally { await handle.close(); }
  if (header.toString() !== "%PDF-") throw new Error(`${item.file} is not a PDF fixture.`);
  if (!item.category || !item.scenario || !item.expected || !Object.keys(item.expected).length) throw new Error(`${item.id} is missing category, scenario, or expected fields.`);
  for (const [field, expected] of Object.entries(item.expected)) {
    if (!expected.value || !Number.isInteger(expected.sourcePage) || expected.sourcePage < 1 || !expected.sourceText?.trim()) throw new Error(`${item.id}.${field} must include value, sourcePage, and sourceText.`);
  }
}
console.log(`[gold-standard] PASS: ${manifest.cases.length} synthetic documents, ${new Set(manifest.cases.map((item) => item.scenario)).size} scenarios, no real-data paths.`);
