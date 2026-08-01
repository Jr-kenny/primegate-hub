import type {
  RegistryPackage,
  RegistryPackageResolution,
  RegistryReview,
  RegistryPublisherSearchResult,
  RegistryPublisherProfile,
} from "@/lib/registry-data";
import type {
  PrimeGateEntitlementRecord,
  PrimeGateInstallRecord,
  PrimeGatePublishedAssetRecord,
  PrimeGatePublisherSaleRecord,
  PrimeGatePurchaseRecord,
} from "@/lib/registry-state";
import { getPrimeGateSessionToken, type PrimeGateSession } from "@/services/auth";
import type { SerializedAptosSignInOutput } from "@aptos-labs/siwa";

type AptosSignInInput = {
  domain: string;
  nonce: string;
  address?: string;
  chainId?: string;
  expirationTime?: string;
  issuedAt?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
  statement?: string;
  uri?: string;
  version?: string;
};

type ApiEnvelope<T> = {
  data: T;
};

type WalletSignInChallenge = {
  expiresAt: string;
  input: AptosSignInInput;
  walletAddress: string;
};

type VerifyWalletSessionPayload = {
  output: SerializedAptosSignInOutput;
};

type WalletSessionResponse = {
  session: PrimeGateSession;
};

type WalletMessageChallenge = {
  application: string;
  chainId: number;
  message: string;
  nonce: string;
  walletAddress: string;
};

type CreatePublishIntentPayload = {
  assetSha256?: string;
  description: string;
  keywords?: string[];
  license?: string;
  mimeType: string;
  originalFileName: string;
  packageSlug: string;
  priceApt: string;
  readmeMarkdown?: string;
  releaseChannel?: string;
  releaseNotes?: string;
  releaseVersion: string;
  sizeBytes: number;
  title: string;
};

type PublishIntentResponse = {
  assetBlobName: string;
  attestationToken: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  manifestBlobName: string;
  ownerAddress: string;
};

type FinalizePublishedAssetPayload = {
  assetEncryptionKey: string;
  attestationToken: string;
};

type VerifyWalletMessageSessionPayload = {
  address: string;
  application?: string;
  bitmap?: number[];
  chainId?: number;
  fullMessage: string;
  message: string;
  minKeysRequired?: number;
  nonce: string;
  prefix: string;
  publicKey: string | string[];
  signature: string | string[];
  walletAddress: string;
};

export type PersistPurchasePayload = {
  packageId: string;
  paymentTxHash?: string;
  walletAddress: string;
};

export type PersistReviewPayload = {
  body: string;
  packageId: string;
  rating: string;
};

export type PrimeGateAuthDebugState = {
  error?: string;
  path: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown> | null;
  status?: number;
};

let lastPrimeGateAuthDebug: PrimeGateAuthDebugState | null = null;

function getApiBaseUrl() {
  return (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
}

function setLastPrimeGateAuthDebug(value: PrimeGateAuthDebugState | null) {
  lastPrimeGateAuthDebug = value;
}

export function getLastPrimeGateAuthDebug() {
  return lastPrimeGateAuthDebug;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  debugRequest?: Record<string, unknown>,
) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

  const sessionToken = getPrimeGateSessionToken();
  if (sessionToken) {
    headers.set("Authorization", `Bearer ${sessionToken}`);
  }

  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });

  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { error?: string } | null;

  if (!response.ok) {
    setLastPrimeGateAuthDebug({
      error:
        payload && typeof payload === "object" && "error" in payload && payload.error
          ? payload.error
          : `Request failed with status ${response.status}.`,
      path,
      request: debugRequest,
      response: payload && typeof payload === "object" ? payload : null,
      status: response.status,
    });
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request failed with status ${response.status}.`,
    );
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    setLastPrimeGateAuthDebug({
      error: "API response was malformed.",
      path,
      request: debugRequest,
      response: payload && typeof payload === "object" ? payload : null,
      status: response.status,
    });
    throw new Error("API response was malformed.");
  }

  setLastPrimeGateAuthDebug({
    path,
    request: debugRequest,
    response:
      payload.data && typeof payload.data === "object"
        ? (payload.data as Record<string, unknown>)
        : null,
    status: response.status,
  });

  return payload.data;
}

export function fetchPackages() {
  return requestJson<RegistryPackage[]>("/api/packages");
}

export function fetchPackageById(id: string) {
  return requestJson<RegistryPackage>(`/api/packages/${encodeURIComponent(id)}`);
}

export function persistPackageReview(review: PersistReviewPayload) {
  return requestJson<RegistryReview>(`/api/packages/${encodeURIComponent(review.packageId)}/reviews`, {
    body: JSON.stringify({
      body: review.body,
      rating: review.rating,
    }),
    method: "POST",
  }, {
    bodyLength: review.body.length,
    packageId: review.packageId,
    rating: review.rating,
  });
}

export function fetchPackageResolution(id: string) {
  return requestJson<RegistryPackageResolution>(`/api/packages/${encodeURIComponent(id)}/resolve`);
}

export function searchCatalog(query: string) {
  return requestJson<RegistryPackage[]>(`/api/search?q=${encodeURIComponent(query)}`);
}

export function searchCatalogPublishers(query: string) {
  return requestJson<RegistryPublisherSearchResult[]>(
    `/api/search/publishers?q=${encodeURIComponent(query)}`,
  );
}

export function fetchPublisherProfile(id: string) {
  return requestJson<RegistryPublisherProfile>(`/api/publishers/${encodeURIComponent(id)}`);
}

export function fetchPublishedAssets(ownerAddress: string) {
  return requestJson<PrimeGatePublishedAssetRecord[]>(
    `/api/published-assets?ownerAddress=${encodeURIComponent(ownerAddress)}`,
  );
}

export function fetchPurchases(walletAddress: string) {
  return requestJson<PrimeGatePurchaseRecord[]>(
    `/api/purchases?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function fetchPublisherSales(ownerAddress: string) {
  return requestJson<PrimeGatePublisherSaleRecord[]>(
    `/api/sales?ownerAddress=${encodeURIComponent(ownerAddress)}`,
  );
}

export function persistPurchase(purchase: PersistPurchasePayload) {
  return requestJson<PrimeGatePurchaseRecord>("/api/purchases", {
    body: JSON.stringify(purchase),
    method: "POST",
  }, {
    hasPaymentTxHash: Boolean(purchase.paymentTxHash),
    packageId: purchase.packageId,
    walletAddress: purchase.walletAddress,
  });
}

export function fetchInstalls(walletAddress: string) {
  return requestJson<PrimeGateInstallRecord[]>(
    `/api/installs?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function persistInstall(install: PrimeGateInstallRecord) {
  return requestJson<PrimeGateInstallRecord>("/api/installs", {
    body: JSON.stringify(install),
    method: "POST",
  });
}

export function fetchEntitlements(walletAddress: string) {
  return requestJson<PrimeGateEntitlementRecord[]>(
    `/api/entitlements?walletAddress=${encodeURIComponent(walletAddress)}`,
  );
}

export function requestWalletSessionNonce(walletAddress: string) {
  return requestJson<WalletSignInChallenge>("/api/auth/nonce", {
    body: JSON.stringify({ walletAddress }),
    method: "POST",
  }, {
    walletAddress,
  });
}

export function requestWalletMessageChallenge(walletAddress: string) {
  return requestJson<WalletMessageChallenge>("/api/auth/message/nonce", {
    body: JSON.stringify({ walletAddress }),
    method: "POST",
  }, {
    walletAddress,
  });
}

export function verifyWalletSessionSignature(payload: VerifyWalletSessionPayload) {
  return requestJson<WalletSessionResponse>("/api/auth/verify", {
    body: JSON.stringify(payload),
    method: "POST",
  }, {
    inputAddress: payload.output.input.address,
    inputChainId: payload.output.input.chainId ?? null,
    inputDomain: payload.output.input.domain,
    inputNonce: payload.output.input.nonce ?? null,
    outputType: payload.output.type,
    outputVersion: payload.output.version,
    publicKeyLength: payload.output.publicKey.length,
    walletAddress: payload.output.input.address,
  });
}

export function verifyWalletMessageSessionSignature(payload: VerifyWalletMessageSessionPayload) {
  return requestJson<WalletSessionResponse>("/api/auth/message/verify", {
    body: JSON.stringify(payload),
    method: "POST",
  }, {
    application: payload.application ?? null,
    bitmapLength: payload.bitmap?.length ?? null,
    chainId: payload.chainId ?? null,
    hasFullMessage: Boolean(payload.fullMessage),
    minKeysRequired: payload.minKeysRequired ?? null,
    prefix: payload.prefix,
    publicKeyCount: Array.isArray(payload.publicKey) ? payload.publicKey.length : 1,
    signatureCount: Array.isArray(payload.signature) ? payload.signature.length : 1,
    walletAddress: payload.walletAddress,
  });
}

export function logoutPrimeGateSession() {
  return requestJson<boolean>("/api/auth/logout", {
    method: "POST",
  });
}

export function requestPublishIntent(payload: CreatePublishIntentPayload) {
  return requestJson<PublishIntentResponse>("/api/publish-intent", {
    body: JSON.stringify(payload),
    method: "POST",
  }, {
    assetSha256: payload.assetSha256,
    keywords: payload.keywords,
    license: payload.license,
    mimeType: payload.mimeType,
    originalFileName: payload.originalFileName,
    packageSlug: payload.packageSlug,
    priceApt: payload.priceApt,
    readmeMarkdown: payload.readmeMarkdown,
    releaseChannel: payload.releaseChannel,
    releaseNotes: payload.releaseNotes,
    releaseVersion: payload.releaseVersion,
    sizeBytes: payload.sizeBytes,
    title: payload.title,
  });
}

export function finalizePublishedAsset(payload: FinalizePublishedAssetPayload) {
  return requestJson<PrimeGatePublishedAssetRecord>("/api/published-assets", {
    body: JSON.stringify(payload),
    method: "POST",
  }, {
    hasAssetEncryptionKey: Boolean(payload.assetEncryptionKey),
    hasAttestationToken: Boolean(payload.attestationToken),
  });
}

export function syncPublishedAssetListing(packageId: string) {
  return requestJson<PrimeGatePublishedAssetRecord>("/api/published-assets?route=listing-status", {
    body: JSON.stringify({ packageId }),
    method: "POST",
  }, {
    packageId,
  });
}
