import { readPrimeGateEnvValue } from "@/lib/primegate-env";

export const PRIMEGATE_APP_NAME = "PrimeGate";
export const PRIMEGATE_APTOS_NETWORK = "testnet" as const;
export const PRIMEGATE_WALLET_NAME = readPrimeGateEnvValue(import.meta.env.VITE_APTOS_WALLET_NAME) || "Petra";
export const PRIMEGATE_SHELBY_API_KEY = readPrimeGateEnvValue(import.meta.env.VITE_SHELBY_API_KEY);
export const PRIMEGATE_SHELBY_BASE_URL =
  readPrimeGateEnvValue(import.meta.env.VITE_SHELBY_RPC_BASE_URL) ||
  "https://api.testnet.shelby.xyz/shelby";
export const PRIMEGATE_DEFAULT_BLOB_TTL_MICROS = 365 * 24 * 60 * 60 * 1_000_000;

export const PRIMEGATE_APTOS_FULLNODE_URL =
  readPrimeGateEnvValue(import.meta.env.VITE_APTOS_FULLNODE_URL) ||
  "https://api.testnet.aptoslabs.com/v1";
