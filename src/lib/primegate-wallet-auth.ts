type PrimeGateWalletNetworkInfo = {
  chainId?: number | string | null;
};

export function getPrimeGateWalletAuthChainId(network: PrimeGateWalletNetworkInfo | null) {
  if (!network?.chainId) {
    return null;
  }

  const chainId = Number(network.chainId);
  return Number.isInteger(chainId) && chainId > 0 ? chainId : null;
}

export function shouldUsePrimeGateWalletMessageAuth(
  supportsSiwa: boolean,
  isOnPrimeGateNetwork: boolean,
) {
  return !supportsSiwa || !isOnPrimeGateNetwork;
}
