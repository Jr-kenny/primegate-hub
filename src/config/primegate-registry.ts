import { AccountAddress } from "@aptos-labs/ts-sdk";

import { PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS } from "@/lib/primegate-registry-contract";

function normalizeAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

export const PRIMEGATE_REGISTRY_CONTRACT_ADDRESS = normalizeAddress(
  import.meta.env.VITE_PRIMEGATE_REGISTRY_ADDRESS?.trim() || PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
);
