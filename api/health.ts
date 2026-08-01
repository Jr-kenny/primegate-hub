import { getDatabaseUrl, getSql } from "./_lib/database.js";
import { isPrimeGateContentEncryptionConfigured } from "./_lib/content-encryption.js";
import { jsonResponse } from "./_lib/request.js";
import { getShelbyApiKey, getShelbyRpcBaseUrl } from "./_lib/shelby.js";
import { readPrimeGateEnvValue } from "../src/lib/primegate-env.js";

export async function GET() {
  const shelbyApiKey = getShelbyApiKey();
  const shelbyRpcBaseUrl = getShelbyRpcBaseUrl();
  const registryAddress =
    readPrimeGateEnvValue(process.env.PRIMEGATE_REGISTRY_ADDRESS) ||
    readPrimeGateEnvValue(process.env.VITE_PRIMEGATE_REGISTRY_ADDRESS);
  const shelbyConfigured = Boolean(shelbyApiKey && shelbyRpcBaseUrl);
  const registryConfigured = Boolean(registryAddress);
  const sessionConfigured = Boolean(readPrimeGateEnvValue(process.env.PRIMEGATE_SESSION_SECRET));
  const publishConfigured = Boolean(readPrimeGateEnvValue(process.env.PRIMEGATE_PUBLISH_SECRET));
  const contentEncryptionConfigured = isPrimeGateContentEncryptionConfigured();

  try {
    const sql = getSql();

    if (!sql) {
      return jsonResponse({
        data: {
          databaseConfigured: false,
          databaseReachable: false,
          network: "testnet",
          publishConfigured,
          registryConfigured,
          sessionConfigured,
          contentEncryptionConfigured,
          shelbyConfigured,
          status: "degraded",
        },
      });
    }

    await sql`select 1 as ok`;

    return jsonResponse({
      data: {
        databaseConfigured: Boolean(getDatabaseUrl()),
        databaseReachable: true,
        network: "testnet",
        publishConfigured,
        registryConfigured,
        sessionConfigured,
        contentEncryptionConfigured,
        shelbyConfigured,
        status:
          shelbyConfigured &&
          registryConfigured &&
          sessionConfigured &&
          publishConfigured &&
          contentEncryptionConfigured
            ? "ok"
            : "degraded",
      },
    });
  } catch (error) {
    console.error("GET /api/health failed", error);
    return jsonResponse(
      {
        error: "Health check failed.",
      },
      { status: 500 },
    );
  }
}
