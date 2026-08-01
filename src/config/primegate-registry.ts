import { PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS } from "@/lib/primegate-registry-contract";
import { normalizeAptosAddress } from "@/lib/aptos-address";
import { readPrimeGateEnvValue } from "@/lib/primegate-env";

function normalizeAddress(address: string) {
  return normalizeAptosAddress(address);
}

export const PRIMEGATE_REGISTRY_CONTRACT_ADDRESS = normalizeAddress(
  readPrimeGateEnvValue(import.meta.env.VITE_PRIMEGATE_REGISTRY_ADDRESS) ||
    PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
);
