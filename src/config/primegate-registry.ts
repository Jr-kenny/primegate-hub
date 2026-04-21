import { PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS } from "@/lib/primegate-registry-contract";
import { normalizeAptosAddress } from "@/lib/aptos-address";

function normalizeAddress(address: string) {
  return normalizeAptosAddress(address);
}

export const PRIMEGATE_REGISTRY_CONTRACT_ADDRESS = normalizeAddress(
  import.meta.env.VITE_PRIMEGATE_REGISTRY_ADDRESS?.trim() || PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
);
