export const PRIMEGATE_APP_NAME = "PrimeGate";
export const PRIMEGATE_APTOS_NETWORK = "testnet" as const;
export const PRIMEGATE_WALLET_NAME = import.meta.env.VITE_APTOS_WALLET_NAME?.trim() || "Petra";
export const PRIMEGATE_SHELBY_API_KEY = import.meta.env.VITE_SHELBY_API_KEY?.trim() || "";
export const PRIMEGATE_SHELBY_BASE_URL =
  import.meta.env.VITE_SHELBY_RPC_BASE_URL?.trim() || "https://api.testnet.shelby.xyz/shelby";
export const PRIMEGATE_DEFAULT_BLOB_TTL_MICROS = 365 * 24 * 60 * 60 * 1_000_000;

export const PRIMEGATE_APTOS_FULLNODE_URL =
  import.meta.env.VITE_APTOS_FULLNODE_URL?.trim() || "https://api.testnet.aptoslabs.com/v1";
