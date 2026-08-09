import type { NetworkInfo } from "@aptos-labs/wallet-adapter-react";

import {
  PRIMEGATE_APTOS_FULLNODE_URL,
} from "@/config/web3-constants";
import {
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
} from "@/config/primegate-network";

type ChangeNetworkResponse =
  | { status: "Approved"; args: { success: boolean; reason?: string } }
  | { status: "Rejected" };

type ChangeNetworkFeature = {
  changeNetwork: (network: NetworkInfo) => Promise<ChangeNetworkResponse>;
};

function getChangeNetworkFeature(features: Record<string, unknown> | null | undefined) {
  const feature = features?.["aptos:changeNetwork"];

  if (
    !feature ||
    typeof feature !== "object" ||
    !("changeNetwork" in feature) ||
    typeof (feature as { changeNetwork?: unknown }).changeNetwork !== "function"
  ) {
    return null;
  }

  return feature as ChangeNetworkFeature;
}

export function isPrimeGateTransactionNetwork(network: NetworkInfo | null | undefined) {
  return Boolean(
    network &&
      network.name === PRIMEGATE_APTOS_NETWORK &&
      Number(network.chainId) === PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
  );
}

export async function requestPrimeGateTransactionNetwork(
  features: Record<string, unknown> | null | undefined,
  walletName: string,
) {
  const feature = getChangeNetworkFeature(features);
  if (!feature) {
    throw new Error(`${walletName} cannot switch to Shelbynet for PrimeGate transactions.`);
  }

  const response = await feature.changeNetwork({
    chainId: PRIMEGATE_APTOS_NUMERIC_CHAIN_ID,
    name: PRIMEGATE_APTOS_NETWORK,
    url: PRIMEGATE_APTOS_FULLNODE_URL,
  });

  if (response.status !== "Approved") {
    throw new Error("The Shelbynet network switch was not approved.");
  }

  if (!response.args.success) {
    throw new Error(response.args.reason || `${walletName} could not switch to Shelbynet.`);
  }
}
