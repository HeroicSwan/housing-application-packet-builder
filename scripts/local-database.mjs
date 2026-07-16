import path from "node:path";

const LOCAL_DATABASE_URL_PATTERN = /^file:\.\/((?:dev|synthetic-[a-z0-9][a-z0-9._-]*)\.db)$/i;

export function resolveLocalDatabaseUrl(repositoryRoot, databaseUrl) {
  const match = LOCAL_DATABASE_URL_PATTERN.exec(databaseUrl);
  if (!match) {
    throw new Error("Local database commands require dev.db or a synthetic-*.db file directly under prisma/.");
  }

  const prismaDirectory = path.resolve(repositoryRoot, "prisma");
  const databasePath = path.resolve(prismaDirectory, match[1]);
  if (path.dirname(databasePath) !== prismaDirectory) {
    throw new Error("The local database path escaped the repository prisma directory.");
  }
  return { databaseUrl, databasePath };
}
