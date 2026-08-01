import type { RegistryPackageResolution } from "../../src/lib/registry-data.js";
import { getAuthenticatedWallet } from "./auth.js";
import {
  getCatalogPurchaseTarget,
  getPackage,
  getPublishedAssetAccess,
  getPublishedAssetById,
  getPublishedAssetOffer,
  listEntitlements,
} from "./catalog.js";
import {
  assertPrimeGateContentEncryptionManifest,
  unwrapPrimeGateContentKey,
} from "./content-encryption.js";
import {
  openPublishedAssetStream,
  readPublishedManifest,
  type PrimeGatePublishedManifest,
} from "./publishing.js";
import {
  getPrimeGateRegistryListing,
  hasPrimeGateRegistryPurchase,
} from "./primegate-registry.js";
import { toAbsoluteUrl } from "./request.js";
import type { PrimeGateContentEncryptionManifest } from "../../src/lib/primegate-content-encryption.js";

function buildResolvePath(packageId: string) {
  return `/api/packages/${encodeURIComponent(packageId)}/resolve`;
}

function buildManifestPath(packageId: string) {
  return `/api/packages/${encodeURIComponent(packageId)}/manifest`;
}

function buildDownloadPath(packageId: string) {
  return `/api/packages/${encodeURIComponent(packageId)}/download`;
}

function buildInstallSnippets(packageId: string, packageName: string) {
  return {
    cli: `primegate install ${packageName}`,
    mcp: `mcp://primegate.io/packages/${packageId}`,
    sdk: `await primegate.install("${packageName}")`,
    web: `/package/${packageId}`,
  };
}

function isFreePrice(price: string) {
  return price.trim().toLowerCase() === "free";
}

type PublishedAssetByteRange = {
  end: number;
  start: number;
};

function parseByteRangeHeader(header: string | null, totalSizeBytes: number) {
  if (!header) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || totalSizeBytes <= 0) {
    return "invalid" as const;
  }

  const [, startText, endText] = match;
  if (!startText && !endText) {
    return "invalid" as const;
  }

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return "invalid" as const;
    }

    return {
      end: totalSizeBytes - 1,
      start: Math.max(totalSizeBytes - suffixLength, 0),
    } satisfies PublishedAssetByteRange;
  }

  const start = Number(startText);
  const requestedEnd = endText ? Number(endText) : totalSizeBytes - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    requestedEnd < start ||
    start >= totalSizeBytes
  ) {
    return "invalid" as const;
  }

  return {
    end: Math.min(requestedEnd, totalSizeBytes - 1),
    start,
  } satisfies PublishedAssetByteRange;
}

async function hasPackageEntitlement(request: Request, packageId: string) {
  const claims = getAuthenticatedWallet(request);
  if (!claims) {
    return false;
  }

  const entitlements = await listEntitlements(claims.walletAddress);
  return entitlements.some((entitlement) => entitlement.packageId === packageId);
}

async function getPublishedAssetPayment(packageId: string, ownerAddress: string, amountOctas: string) {
  const listing = await getPrimeGateRegistryListing(packageId);
  if (!listing) {
    return null;
  }

  if (listing.sellerAddress !== ownerAddress.toLowerCase()) {
    return null;
  }

  if (listing.priceOctas.toString() !== amountOctas) {
    return null;
  }

  return {
    amountApt: purchaseTargetAmountApt(amountOctas),
    amountOctas,
    currency: "APT" as const,
    network: "testnet" as const,
    recipientAddress: listing.sellerAddress,
  };
}

function purchaseTargetAmountApt(amountOctas: string) {
  const octas = BigInt(amountOctas);
  const whole = octas / 100000000n;
  const fractional = (octas % 100000000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

async function getPublishedAssetDecryptionContext(packageId: string) {
  const access = await getPublishedAssetAccess(packageId);

  if (!access || (!access.contentKeyEnvelope && !access.encryptionJson)) {
    return null;
  }

  if (!access.contentKeyEnvelope || !access.encryptionJson) {
    throw new Error("PrimeGate release encryption record is incomplete.");
  }

  let encryption: PrimeGateContentEncryptionManifest;
  try {
    encryption = JSON.parse(access.encryptionJson) as PrimeGateContentEncryptionManifest;
    assertPrimeGateContentEncryptionManifest(encryption);
  } catch {
    throw new Error("PrimeGate release encryption metadata is invalid.");
  }

  return {
    contentKey: unwrapPrimeGateContentKey(access.contentKeyEnvelope),
    encryption,
  };
}

export async function getPackageResolution(
  request: Request,
  packageId: string,
): Promise<RegistryPackageResolution> {
  const pkg = await getPackage(packageId);
  const publishedAsset = await getPublishedAssetById(packageId);
  const install = buildInstallSnippets(pkg.id, publishedAsset ? pkg.id : pkg.name);
  const publiclyAccessible = isFreePrice(pkg.price);
  const purchaseTarget = await getCatalogPurchaseTarget(packageId);
  const directPayment =
    purchaseTarget && "payment" in purchaseTarget ? purchaseTarget.payment ?? null : null;
  const resolvePath = buildResolvePath(pkg.id);
  const resolveUrl = toAbsoluteUrl(request, resolvePath);
  const payment =
    publishedAsset &&
    purchaseTarget?.kind === "published-asset" &&
    purchaseTarget.payment.amountOctas !== "0"
      ? await getPublishedAssetPayment(
          packageId,
          publishedAsset.ownerAddress,
          purchaseTarget.payment.amountOctas,
        )
      : purchaseTarget?.kind === "published-asset"
        ? null
        : directPayment && directPayment.amountOctas !== "0"
          ? {
              amountApt: directPayment.amountApt,
              amountOctas: directPayment.amountOctas,
              currency: "APT" as const,
              network: "testnet" as const,
              recipientAddress: directPayment.recipientAddress,
            }
          : null;
  const claims = getAuthenticatedWallet(request);
  const offer =
    publishedAsset && purchaseTarget?.kind === "published-asset"
      ? purchaseTarget.offer
      : publishedAsset
        ? await getPublishedAssetOffer(packageId)
        : null;
  const entitled =
    publishedAsset && payment
      ? claims
        ? await hasPrimeGateRegistryPurchase(packageId, claims.walletAddress)
        : false
      : publiclyAccessible
        ? true
        : await hasPackageEntitlement(request, packageId);

  if (!publishedAsset) {
    return {
      access: publiclyAccessible ? "public" : "purchase-required",
      artifact: null,
      downloadPath: null,
      downloadUrl: null,
      install,
      manifestPath: null,
      manifestUrl: null,
      offer: null,
      packageHandle: pkg.packageHandle ?? null,
      packageId: pkg.id,
      packageName: pkg.name,
      payment,
      price: pkg.price,
      resolvePath,
      resolveUrl,
      version: pkg.version,
    };
  }

  const manifestPath = buildManifestPath(pkg.id);
  const downloadPath = buildDownloadPath(pkg.id);
  const manifestUrl = toAbsoluteUrl(request, manifestPath);
  const downloadUrl = toAbsoluteUrl(request, downloadPath);
  const decryptionContext = entitled
    ? await getPublishedAssetDecryptionContext(packageId)
    : null;
  let manifest: PrimeGatePublishedManifest | null = null;

  if (entitled) {
    try {
      manifest = await readPublishedManifest(
        publishedAsset.ownerAddress,
        publishedAsset.manifestBlobName,
        decryptionContext
          ? {
              contentKey: decryptionContext.contentKey,
              expectedEncryption: decryptionContext.encryption,
            }
          : undefined,
      );
    } catch (error) {
      if (publishedAsset.encrypted) {
        throw error;
      }
      manifest = null;
    }
  }

  return {
    access: publiclyAccessible ? "public" : "purchase-required",
    artifact: entitled
      ? {
          assetBlobName: publishedAsset.assetBlobName,
          assetSha256: manifest?.assetSha256 ?? publishedAsset.assetSha256 ?? undefined,
          createdAt: publishedAsset.createdAt,
          encrypted: publishedAsset.encrypted,
          downloadPath,
          downloadUrl,
          manifestBlobName: publishedAsset.manifestBlobName,
          manifestPath,
          manifestUrl,
          mimeType: publishedAsset.mimeType,
          originalFileName: publishedAsset.originalFileName,
          ownerAddress: publishedAsset.ownerAddress,
          sizeBytes: publishedAsset.sizeBytes,
          storage: "shelby",
        }
      : null,
    downloadPath: entitled ? downloadPath : null,
    downloadUrl: entitled ? downloadUrl : null,
    install,
    manifestPath: entitled ? manifestPath : null,
    manifestUrl: entitled ? manifestUrl : null,
    offer,
    packageHandle: pkg.packageHandle ?? null,
    packageId: pkg.id,
    packageName: pkg.name,
    payment,
    price: pkg.price,
    resolvePath,
    resolveUrl,
    version: pkg.version,
  };
}

export async function getPublishedPackageManifest(request: Request, packageId: string) {
  const resolution = await getPackageResolution(request, packageId);
  const publishedAsset = await getPublishedAssetById(packageId);

  if (!publishedAsset || !resolution.manifestPath) {
    return null;
  }

  const decryptionContext = await getPublishedAssetDecryptionContext(packageId);
  const manifest = await readPublishedManifest(
    publishedAsset.ownerAddress,
    publishedAsset.manifestBlobName,
    decryptionContext
      ? {
          contentKey: decryptionContext.contentKey,
          expectedEncryption: decryptionContext.encryption,
        }
      : undefined,
  );

  return {
    cacheControl: resolution.access === "public" ? "public, max-age=60" : "private, no-store",
    manifest: {
      ...manifest,
      assetSha256: publishedAsset.assetSha256 ?? manifest.assetSha256,
    },
  };
}

export async function downloadPublishedPackageArtifact(request: Request, packageId: string) {
  const resolution = await getPackageResolution(request, packageId);
  const publishedAsset = await getPublishedAssetById(packageId);

  if (!publishedAsset || !resolution.downloadPath) {
    return null;
  }

  const range = parseByteRangeHeader(request.headers.get("range"), publishedAsset.sizeBytes);
  if (range === "invalid") {
    return {
      body: null,
      cacheControl: resolution.access === "public" ? "public, max-age=60" : "private, no-store",
      contentRange: `bytes */${publishedAsset.sizeBytes}`,
      mimeType: publishedAsset.mimeType,
      originalFileName: publishedAsset.originalFileName,
      sizeBytes: 0,
      status: 416 as const,
    };
  }

  const decryptionContext = await getPublishedAssetDecryptionContext(packageId);
  const assetStream = await openPublishedAssetStream(
    publishedAsset.ownerAddress,
    publishedAsset.assetBlobName,
    range ?? undefined,
    decryptionContext
      ? {
          contentKey: decryptionContext.contentKey,
          encryption: decryptionContext.encryption,
          expectedPlaintextSize: publishedAsset.sizeBytes,
        }
      : undefined,
  );

  return {
    body: assetStream,
    cacheControl: resolution.access === "public" ? "public, max-age=60" : "private, no-store",
    contentRange: range ? `bytes ${range.start}-${range.end}/${publishedAsset.sizeBytes}` : null,
    mimeType: publishedAsset.mimeType,
    originalFileName: publishedAsset.originalFileName,
    sizeBytes: range ? range.end - range.start + 1 : publishedAsset.sizeBytes,
    status: range ? (206 as const) : (200 as const),
  };
}
