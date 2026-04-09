import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";

export const PRIMEGATE_APP_NAME = "PrimeGate";
export const PRIMEGATE_APTOS_NETWORK = Network.TESTNET;
export const PRIMEGATE_WALLET_NAME = import.meta.env.VITE_APTOS_WALLET_NAME ?? "Petra";
export const PRIMEGATE_SHELBY_API_KEY = import.meta.env.VITE_SHELBY_API_KEY?.trim() || "";
export const PRIMEGATE_SHELBY_BASE_URL =
  import.meta.env.VITE_SHELBY_RPC_BASE_URL?.trim() || "https://api.testnet.shelby.xyz/shelby";
export const PRIMEGATE_DEFAULT_BLOB_TTL_MICROS = 365 * 24 * 60 * 60 * 1_000_000;

export const aptosClient = new Aptos(
  new AptosConfig({
    network: PRIMEGATE_APTOS_NETWORK,
  }),
);

export const shelbyClient = new ShelbyClient({
  apiKey: PRIMEGATE_SHELBY_API_KEY || undefined,
  network: PRIMEGATE_APTOS_NETWORK,
  rpc: {
    baseUrl: PRIMEGATE_SHELBY_BASE_URL,
  },
});
