import { neon } from "@neondatabase/serverless";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

let sqlClient: ReturnType<typeof neon> | null = null;

export function getDatabaseUrl() {
  return readPrimeGateEnvValue(process.env.DATABASE_URL);
}

export function getSql() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  sqlClient ??= neon(databaseUrl);
  return sqlClient;
}
