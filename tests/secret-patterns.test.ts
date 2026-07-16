import { describe, expect, it } from "vitest";
import { findSecretCategories } from "../scripts/secret-patterns.mjs";
import { scanTextForSecrets } from "../scripts/scan-git-history-secrets.mjs";

function categoriesFor(line: string) {
  return findSecretCategories(line);
}

describe("provider secret patterns", () => {
  it("detects a SambaNova-shaped assignment", () => {
    const line = ["SAMBANOVA_API", "_KEY=", "00000000-0000-0000-0000-000000000000"].join("");
    expect(categoriesFor(line)).toContain("SambaNova API key");
  });

  it("detects a Mistral-shaped assignment", () => {
    const line = ["MISTRAL_API", "_KEY=", "synthetic", "notakey", "0000000000000000"].join("");
    expect(categoriesFor(line)).toContain("Mistral API key");
  });

  it("does not flag empty example values", () => {
    expect(categoriesFor("MISTRAL_API_KEY=\"\"")).toEqual([]);
    expect(categoriesFor("SAMBANOVA_API_KEY=\"\"")).toEqual([]);
  });

  it("detects generic credential assignments without exposing the value", () => {
    const variable = ["SESSION", "SECRET"].join("_");
    expect(categoriesFor(`${variable}=${"q".repeat(48)}`)).toContain("SESSION_SECRET assignment");
  });

  it("allows explicit repository placeholders", () => {
    expect(categoriesFor("SESSION_SECRET=replace-with-a-random-secret")).toEqual([]);
    expect(categoriesFor("DATA_ENCRYPTION_KEY=\"\"")).toEqual([]);
  });

  it("reports history findings without retaining the credential value", () => {
    const credential = `gsk_${"x".repeat(32)}`;
    const findings = scanTextForSecrets(`safe line\nGROQ_API_KEY=${credential}`);
    expect(findings).toEqual([{ line: 2, category: "Groq API key" }, { line: 2, category: "GROQ_API_KEY assignment" }]);
    expect(JSON.stringify(findings)).not.toContain(credential);
  });
});
