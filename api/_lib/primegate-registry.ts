import {
  AccountAddress,
  Aptos,
  AptosConfig,
  Network,
  type EntryFunctionArgumentTypes,
  type SimpleEntryFunctionArgumentTypes,
} from "@aptos-labs/ts-sdk";

import {
  PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
  encodePrimeGatePackageId,
  getPrimeGateRegistryFunctionId,
} from "../../src/lib/primegate-registry-contract.js";

const aptos = new Aptos(
  new AptosConfig({
    network: Network.TESTNET,
  }),
);

type ViewFunctionArgument = EntryFunctionArgumentTypes | SimpleEntryFunctionArgumentTypes;
type PrimeGateFunctionId = `${string}::${string}::${string}`;

function getRegistryFunctionId(functionName: string) {
  return getPrimeGateRegistryFunctionId(
    getPrimeGateRegistryContractAddress(),
    functionName,
  ) as PrimeGateFunctionId;
}

function normalizeAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

export function getPrimeGateRegistryContractAddress() {
  return normalizeAddress(
    process.env.PRIMEGATE_REGISTRY_ADDRESS?.trim() ||
      process.env.VITE_PRIMEGATE_REGISTRY_ADDRESS?.trim() ||
      PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
  );
}

async function viewBoolean(functionName: string, args: ViewFunctionArgument[]) {
  const [value] = await aptos.view<[boolean]>({
    payload: {
      function: getRegistryFunctionId(functionName),
      functionArguments: args,
    },
  });

  return Boolean(value);
}

async function viewAddress(functionName: string, args: ViewFunctionArgument[]) {
  const [value] = await aptos.view<[string]>({
    payload: {
      function: getRegistryFunctionId(functionName),
      functionArguments: args,
    },
  });

  return typeof value === "string" ? normalizeAddress(value) : null;
}

async function viewU64(functionName: string, args: ViewFunctionArgument[]) {
  const [value] = await aptos.view<[string | number]>({
    payload: {
      function: getRegistryFunctionId(functionName),
      functionArguments: args,
    },
  });

  return BigInt(String(value ?? 0));
}

export async function getPrimeGateRegistryListing(packageId: string) {
  const packageIdBytes = encodePrimeGatePackageId(packageId);
  const hasActiveListing = await viewBoolean("has_active_listing", [packageIdBytes]);
  if (!hasActiveListing) {
    return null;
  }

  const [sellerAddress, priceOctas] = await Promise.all([
    viewAddress("get_active_listing_seller", [packageIdBytes]),
    viewU64("get_active_listing_price", [packageIdBytes]),
  ]);

  if (!sellerAddress || priceOctas <= 0n || sellerAddress === normalizeAddress("0x0")) {
    return null;
  }

  return {
    priceOctas,
    sellerAddress,
  };
}

export function hasPrimeGateRegistryPurchase(packageId: string, buyerAddress: string) {
  return viewBoolean("has_purchase", [
    encodePrimeGatePackageId(packageId),
    normalizeAddress(buyerAddress),
  ]);
}
