import { Network } from "@aptos-labs/ts-sdk";

export const PRIMEGATE_APTOS_NETWORK = Network.SHELBYNET;
export const PRIMEGATE_APTOS_NETWORK_NAME = "shelbynet" as const;
export const PRIMEGATE_APTOS_CHAIN_ID = "aptos:shelbynet" as const;

// The Aptos SDK does not include Shelbynet in NetworkToChainId yet.
export const PRIMEGATE_APTOS_NUMERIC_CHAIN_ID = 118;

export const PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL =
  "https://api.shelbynet.shelby.xyz/shelby";
export const PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL =
  "https://api.shelbynet.shelby.xyz/v1";

// Nightly expects a complete custom-network descriptor for Shelbynet.
export const PRIMEGATE_APTOS_WALLET_NETWORK_INFO = {
  name: Network.CUSTOM,
  chainId: PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
  url: PRIMEGATE_DEFAULT_APTOS_FULLNODE_URL,
} as const;
