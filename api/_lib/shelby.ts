import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import {
  PRIMEGATE_SHELBY_APTOS_NETWORK,
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL,
} from "../../src/config/primegate-network.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

const PRIMEGATE_DEFAULT_APP_ORIGIN = "https://primegatelive.vercel.app";

export function getShelbyRpcBaseUrl() {
  return (
    readPrimeGateEnvValue(process.env.SHELBY_RPC_BASE_URL) ||
    readPrimeGateEnvValue(process.env.VITE_SHELBY_RPC_BASE_URL) ||
    PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL
  );
}

export function getShelbyApiKey() {
  return (
    readPrimeGateEnvValue(process.env.SHELBY_API_KEY) ||
    readPrimeGateEnvValue(process.env.VITE_SHELBY_API_KEY) ||
    undefined
  );
}

export function getShelbyRequestOrigin() {
  const configuredOrigin =
    readPrimeGateEnvValue(process.env.PRIMEGATE_APP_ORIGIN) ||
    readPrimeGateEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    PRIMEGATE_DEFAULT_APP_ORIGIN;

  return configuredOrigin.startsWith("http://") || configuredOrigin.startsWith("https://")
    ? configuredOrigin
    : `https://${configuredOrigin}`;
}

let shelbyClient: ShelbyNodeClient | null = null;

export function getShelbyClient() {
  if (!shelbyClient) {
    shelbyClient = new ShelbyNodeClient({
      apiKey: getShelbyApiKey(),
      aptos: {
        fullnodeConfig: {
          HEADERS: {
            Origin: getShelbyRequestOrigin(),
          },
        },
      },
      network: PRIMEGATE_SHELBY_APTOS_NETWORK,
      rpc: {
        baseUrl: getShelbyRpcBaseUrl(),
      },
    });
  }

  return shelbyClient;
}
