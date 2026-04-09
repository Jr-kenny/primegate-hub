export type PrimeGatePurchaseRecord = {
  packageId: string;
  packageName: string;
  paymentAmountOctas: string | null;
  paymentRecipient: string | null;
  paymentTxHash: string | null;
  price: string;
  purchasedAt: string;
  publisher: string;
  version: string;
  walletAddress: string;
};

export type PrimeGatePublisherSaleRecord = {
  buyerWalletAddress: string;
  packageId: string;
  packageName: string;
  paymentAmountOctas: string | null;
  paymentRecipient: string | null;
  paymentTxHash: string | null;
  price: string;
  purchasedAt: string;
  publisher: string;
  version: string;
};

export type PrimeGateInstallRecord = {
  installedAt: string;
  packageId: string;
  packageName: string;
  version: string;
  walletAddress: string;
};

export type PrimeGateEntitlementRecord = {
  grantedAt: string;
  packageId: string;
  packageName: string;
  source: "free" | "purchase";
  walletAddress: string;
};

export type PrimeGatePublishedAssetRecord = {
  assetBlobName: string;
  createdAt: string;
  description: string;
  id: string;
  manifestBlobName: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  packageHandle: string;
  packageSlug: string;
  price: number;
  sizeBytes: number;
  title: string;
  version: string;
};
