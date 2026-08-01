import { Network } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

export function getShelbyRpcBaseUrl() {
  return (
    readPrimeGateEnvValue(process.env.SHELBY_RPC_BASE_URL) ||
    readPrimeGateEnvValue(process.env.VITE_SHELBY_RPC_BASE_URL) ||
    "https://api.testnet.shelby.xyz/shelby"
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
      network: Network.TESTNET,
      rpc: {
        baseUrl: getShelbyRpcBaseUrl(),
      },
    });
  }

  return shelbyClient;
}
