import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import {
  PRIMEGATE_SHELBY_APTOS_NETWORK,
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL,
} from "../../src/config/primegate-network.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

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

let shelbyClient: ShelbyNodeClient | null = null;

export function getShelbyClient() {
  if (!shelbyClient) {
    shelbyClient = new ShelbyNodeClient({
      apiKey: getShelbyApiKey(),
      network: PRIMEGATE_SHELBY_APTOS_NETWORK,
      rpc: {
        baseUrl: getShelbyRpcBaseUrl(),
      },
    });
  }

  return shelbyClient;
}
