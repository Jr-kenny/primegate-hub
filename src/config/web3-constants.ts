import { readPrimeGateEnvValue } from "@/lib/primegate-env";
import {
  PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL,
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL,
} from "@/config/primegate-network";

export { PRIMEGATE_APTOS_NETWORK } from "@/config/primegate-network";

export const PRIMEGATE_APP_NAME = "PrimeGate";
export const PRIMEGATE_WALLET_NAME = readPrimeGateEnvValue(import.meta.env.VITE_APTOS_WALLET_NAME) || "Petra";
export const PRIMEGATE_SHELBY_API_KEY = readPrimeGateEnvValue(import.meta.env.VITE_SHELBY_API_KEY);
export const PRIMEGATE_SHELBY_BASE_URL =
  readPrimeGateEnvValue(import.meta.env.VITE_SHELBY_RPC_BASE_URL) ||
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL;
export const PRIMEGATE_DEFAULT_BLOB_TTL_MICROS = 365 * 24 * 60 * 60 * 1_000_000;

export const PRIMEGATE_APTOS_FULLNODE_URL =
  readPrimeGateEnvValue(import.meta.env.VITE_APTOS_FULLNODE_URL) ||
  PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL;
