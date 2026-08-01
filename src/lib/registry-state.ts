export type PrimeGateOfferRecord = {
  id: string | null;
  slug: string;
  name: string;
  description: string;
  price: string;
  currency: "APT";
  license: string;
  updatePolicy: "release-only" | "patches" | "minor" | "lifetime";
  includedArtifacts: string[];
};

export type PrimeGatePurchaseRecord = {
  packageId: string;
  packageName: string;
  offerId: string | null;
  offerName: string;
  offerSlug: string;
  offerLicense: string;
  offerUpdatePolicy: PrimeGateOfferRecord["updatePolicy"];
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
  offerId: string | null;
  offerName: string;
  offerSlug: string;
  offerLicense: string;
  offerUpdatePolicy: PrimeGateOfferRecord["updatePolicy"];
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
  offerId: string | null;
  offerName: string;
  offerSlug: string;
  offerLicense: string;
  offerUpdatePolicy: PrimeGateOfferRecord["updatePolicy"];
  source: "free" | "purchase";
  walletAddress: string;
};

export type PrimeGatePublishedAssetRecord = {
  assetBlobName: string;
  assetSha256: string | null;
  createdAt: string;
  description: string;
  encrypted: boolean;
  id: string;
  keywords: string[];
  license: string;
  manifestBlobName: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  packageHandle: string;
  packageSlug: string;
  price: number;
  readmeMarkdown: string;
  releaseChannel: string;
  releaseNotes: string;
  offer: PrimeGateOfferRecord;
  listingStatus: "active" | "failed" | "pending";
  listingError: string | null;
  sizeBytes: number;
  title: string;
  version: string;
};
