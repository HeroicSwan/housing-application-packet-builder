import path from "node:path";

const DATABASE_URL_PATTERN = /^file:\.\/\.e2e\/(e2e-[a-z0-9][a-z0-9-]{0,80}\.db)$/;
const RUN_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,76}$/;

export function resolveE2eDatabaseUrl(repositoryRoot, databaseUrl) {
  const match = DATABASE_URL_PATTERN.exec(databaseUrl);
  if (!match) throw new Error("E2E_DATABASE_URL must select a generated database directly under prisma/.e2e.");

  const databaseDirectory = path.resolve(repositoryRoot, "prisma", ".e2e");
  const databasePath = path.resolve(databaseDirectory, match[1]);
  if (path.dirname(databasePath) !== databaseDirectory || path.basename(databasePath) !== match[1]) {
    throw new Error("The E2E database path escaped the isolated prisma/.e2e directory.");
  }

  return { databaseUrl, databaseDirectory, databasePath, filename: match[1] };
}

export function createE2eDatabaseTarget(repositoryRoot, runId) {
  if (!RUN_ID_PATTERN.test(runId)) throw new Error("The E2E run identifier is invalid.");
  return resolveE2eDatabaseUrl(repositoryRoot, `file:./.e2e/e2e-${runId}.db`);
}
