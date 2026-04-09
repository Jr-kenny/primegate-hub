import { neon } from "@neondatabase/serverless";

let sqlClient: ReturnType<typeof neon> | null = null;

export function getDatabaseUrl() {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export function getSql() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}
