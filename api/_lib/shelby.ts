import { Network } from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

const PRIMEGATE_SHELBY_RPC_BASE_URL =
  process.env.VITE_SHELBY_RPC_BASE_URL?.trim() || "https://api.testnet.shelby.xyz/shelby";
const PRIMEGATE_SHELBY_API_KEY = process.env.VITE_SHELBY_API_KEY?.trim() || undefined;

let shelbyClient: ShelbyNodeClient | null = null;

export function getShelbyClient() {
  if (!shelbyClient) {
    shelbyClient = new ShelbyNodeClient({
      apiKey: PRIMEGATE_SHELBY_API_KEY,
      network: Network.TESTNET,
      rpc: {
        baseUrl: PRIMEGATE_SHELBY_RPC_BASE_URL,
      },
    });
  }

  return shelbyClient;
}
