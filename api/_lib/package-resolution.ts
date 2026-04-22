import type { RegistryPackageResolution } from "../../src/lib/registry-data.js";
import { getAuthenticatedWallet } from "./auth.js";
import {
  getCatalogPurchaseTarget,
  getPackage,
  getPublishedAssetById,
  listEntitlements,
} from "./catalog.js";
import {
  readPublishedAssetBytes,
  readPublishedManifest,
  type PrimeGatePublishedManifest,
} from "./publishing.js";
import {
  getPrimeGateRegistryListing,
  hasPrimeGateRegistryPurchase,
} from "./primegate-registry.js";
import { toAbsoluteUrl } from "./request.js";

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
  let manifest: PrimeGatePublishedManifest | null = null;

  try {
    manifest = await readPublishedManifest(publishedAsset.ownerAddress, publishedAsset.manifestBlobName);
  } catch {
    manifest = null;
  }

  return {
    access: publiclyAccessible ? "public" : "purchase-required",
    artifact: entitled
      ? {
          assetBlobName: publishedAsset.assetBlobName,
          assetSha256: manifest?.assetSha256,
          createdAt: publishedAsset.createdAt,
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

  return readPublishedManifest(publishedAsset.ownerAddress, publishedAsset.manifestBlobName);
}

export async function downloadPublishedPackageArtifact(request: Request, packageId: string) {
  const resolution = await getPackageResolution(request, packageId);
  const publishedAsset = await getPublishedAssetById(packageId);

  if (!publishedAsset || !resolution.downloadPath) {
    return null;
  }

  const assetBytes = await readPublishedAssetBytes(
    publishedAsset.ownerAddress,
    publishedAsset.assetBlobName,
  );

  return {
    bytes: assetBytes,
    mimeType: publishedAsset.mimeType,
    originalFileName: publishedAsset.originalFileName,
  };
}
