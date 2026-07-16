import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { applicationDataModels } from "../scripts/application-data.mjs";

describe("application data inventory", () => {
  it("includes every Prisma model in the empty-database guard", () => {
    const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
    const schemaModels = [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)]
      .map(([, model]) => `${model[0].toLowerCase()}${model.slice(1)}`)
      .sort();
    expect([...applicationDataModels].sort()).toEqual(schemaModels);
  });
});
