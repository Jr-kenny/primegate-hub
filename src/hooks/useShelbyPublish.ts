import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";
import { AccountAddress } from "@aptos-labs/ts-sdk";

import { PRIMEGATE_REGISTRY_CONTRACT_ADDRESS } from "@/config/primegate-registry";
import {
  PRIMEGATE_DEFAULT_BLOB_TTL_MICROS,
  PRIMEGATE_SHELBY_API_KEY,
} from "@/config/web3-constants";
import { shelbyClient } from "@/config/web3";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";
import { getPrimeGateTransactionOptions, waitForPrimeGateTransaction } from "@/lib/aptos-client";
import { normalizeAptAmount, parseAptAmountToOctas } from "@/lib/aptos-amount";
import {
  normalizePrimeGatePackageSlug,
  normalizePrimeGateReleaseVersion,
} from "@/lib/primegate-package";
import {
  createPrimeGateContentKey,
  createPrimeGateContentNonce,
  createPrimeGateEncryptedBytesStream,
  createPrimeGateEncryptedStream,
  decodePrimeGateBase64Url,
  encodePrimeGateBase64Url,
  PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM,
  PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
  PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_VERSION,
} from "@/lib/primegate-content-encryption";
import { encodePrimeGatePackageId, getPrimeGateRegistryFunctionId } from "@/lib/primegate-registry-contract";
import {
  finalizePublishedAsset,
  requestPublishIntent,
  syncPublishedAssetListing,
} from "@/lib/registry-api";

type PublishAssetArgs = {
  description: string;
  file: File;
  keywords: string[];
  license: string;
  packageSlug: string;
  priceApt: string;
  readmeMarkdown: string;
  releaseChannel: string;
  releaseNotes: string;
  releaseVersion: string;
  title: string;
};

type PrimeGatePublishedManifest = {
  assetBlobName: string;
  assetSha256?: string;
  createdAt: string;
  description: string;
  encryption: {
    algorithm: typeof PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM;
    asset: { nonce: string };
    chunkSize: number;
    headerBytes: typeof PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES;
    manifest: { nonce: string };
    tagBytes: typeof PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES;
    version: typeof PRIMEGATE_CONTENT_ENCRYPTION_VERSION;
  };
  keywords: string[];
  license: string;
  manifestBlobName: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  packageSlug: string;
  priceApt: string;
  publishAttestation: string;
  publishIntentId: string;
  readmeMarkdown: string;
  releaseChannel: string;
  releaseNotes: string;
  releaseVersion: string;
  sizeBytes: number;
  source: "primegate";
  title: string;
  version: 1;
};

export type PublishedAssetResult = {
  assetBlobName: string;
  assetSha256: string | null;
  encrypted: boolean;
  createdAt: string;
  id: string;
  keywords: string[];
  license: string;
  manifestBlobName: string;
  mimeType: string;
  ownerAddress: string;
  originalFileName: string;
  packageHandle: string;
  packageSlug: string;
  price: number;
  readmeMarkdown: string;
  releaseChannel: string;
  releaseNotes: string;
  listingStatus: "active" | "failed" | "pending";
  listingError: string | null;
  sizeBytes: number;
  title: string;
  version: string;
};

export function useShelbyPublish() {
  const [error, setError] = useState<string | null>(null);
  const [isPublishingAsset, setIsPublishingAsset] = useState(false);
  const [retryingListingId, setRetryingListingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const {
    account,
    address,
    ensurePrimeGateSession,
    isWrongNetwork,
    requiredNetworkName,
    signAndSubmitTransaction,
  } = usePrimeGateWallet();
  const canPublish = useMemo(
    () => Boolean(account?.address && signAndSubmitTransaction),
    [account?.address, signAndSubmitTransaction],
  );

  const publishAsset = async ({
    description,
    file,
    keywords,
    license,
    packageSlug,
    priceApt,
    readmeMarkdown,
    releaseChannel,
    releaseNotes,
    releaseVersion,
    title,
  }: PublishAssetArgs) => {
    if (!address || !account?.address) {
      throw new Error("Connect an Aptos wallet before publishing.");
    }

    if (!PRIMEGATE_SHELBY_API_KEY) {
      throw new Error("Shelby API key is missing. Set VITE_SHELBY_API_KEY before publishing.");
    }

    setError(null);
    setIsPublishingAsset(true);

    try {
      const mimeType = file.type || "application/octet-stream";
      const normalizedPackageSlug = normalizePrimeGatePackageSlug(packageSlug);
      const normalizedPriceApt = normalizeAptAmount(priceApt);
      const normalizedReleaseVersion = normalizePrimeGateReleaseVersion(releaseVersion);

      await ensurePrimeGateSession();

      const publishIntent = await requestPublishIntent({
        description,
        keywords,
        license,
        mimeType,
        originalFileName: file.name,
        packageSlug: normalizedPackageSlug,
        priceApt: normalizedPriceApt,
        readmeMarkdown,
        releaseChannel,
        releaseNotes,
        releaseVersion: normalizedReleaseVersion,
        sizeBytes: file.size,
        title,
      });

      queryClient.setQueryData(
        ["primegate", "publisher-billing", address.toLowerCase()],
        publishIntent.billing,
      );

      const contentKey = createPrimeGateContentKey();
      const assetEncryption = await createPrimeGateEncryptedStream(
        file.stream(),
        file.size,
        "asset",
        contentKey,
      );
      const manifestNonce = createPrimeGateContentNonce();

      const manifest: PrimeGatePublishedManifest = {
        assetBlobName: publishIntent.assetBlobName,
        createdAt: publishIntent.createdAt,
        description,
        encryption: {
          algorithm: PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM,
          asset: { nonce: assetEncryption.nonce },
          chunkSize: PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
          headerBytes: PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES,
          manifest: { nonce: encodePrimeGateBase64Url(manifestNonce) },
          tagBytes: PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
          version: PRIMEGATE_CONTENT_ENCRYPTION_VERSION,
        },
        keywords,
        license,
        manifestBlobName: publishIntent.manifestBlobName,
        mimeType,
        originalFileName: file.name,
        ownerAddress: address,
        packageSlug: normalizedPackageSlug,
        priceApt: normalizedPriceApt,
        publishAttestation: publishIntent.attestationToken,
        publishIntentId: publishIntent.id,
        readmeMarkdown,
        releaseChannel,
        releaseNotes,
        releaseVersion: normalizedReleaseVersion,
        sizeBytes: file.size,
        source: "primegate",
        title,
        version: 1,
      };

      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const manifestEncryption = await createPrimeGateEncryptedBytesStream(
        manifestBytes,
        "manifest",
        contentKey,
        { nonce: manifestNonce },
      );
      const provider = await createDefaultErasureCodingProvider();
      const assetCommitments = await generateCommitments(provider, assetEncryption.stream);
      const manifestCommitments = await generateCommitments(provider, manifestEncryption.stream);

      if (assetCommitments.raw_data_size !== assetEncryption.ciphertextSize) {
        throw new Error("PrimeGate encrypted asset size did not match Shelby commitment size.");
      }

      if (manifestCommitments.raw_data_size !== manifestEncryption.ciphertextSize) {
        throw new Error("PrimeGate encrypted manifest size did not match Shelby commitment size.");
      }
      const shelbyBuildOptions = await getPrimeGateTransactionOptions(50_000);
      const shelbyExpirationMicros = Date.now() * 1000 + PRIMEGATE_DEFAULT_BLOB_TTL_MICROS;
      const pendingShelbyRegistration = await signAndSubmitTransaction({
        data: ShelbyBlobClient.createBatchRegisterBlobsPayload({
          account: AccountAddress.from(account.address),
          expirationMicros: shelbyExpirationMicros,
          blobs: [
            {
              blobName: publishIntent.assetBlobName,
              blobMerkleRoot: assetCommitments.blob_merkle_root,
              blobSize: assetCommitments.raw_data_size,
              numChunksets: expectedTotalChunksets(
                assetCommitments.raw_data_size,
                provider.config.chunkSizeBytes * provider.config.erasure_k,
              ),
            },
            {
              blobName: publishIntent.manifestBlobName,
              blobMerkleRoot: manifestCommitments.blob_merkle_root,
              blobSize: manifestCommitments.raw_data_size,
              numChunksets: expectedTotalChunksets(
                manifestCommitments.raw_data_size,
                provider.config.chunkSizeBytes * provider.config.erasure_k,
              ),
            },
          ],
          encoding: provider.config.enumIndex,
        }),
        options: {
          ...shelbyBuildOptions,
        },
      });

      await waitForPrimeGateTransaction(pendingShelbyRegistration.hash);
      const assetUpload = await createPrimeGateEncryptedStream(
        file.stream(),
        file.size,
        "asset",
        contentKey,
        { nonce: decodePrimeGateBase64Url(assetEncryption.nonce) },
      );
      const manifestUpload = await createPrimeGateEncryptedBytesStream(
        manifestBytes,
        "manifest",
        contentKey,
        { nonce: manifestNonce },
      );
      await Promise.all([
        shelbyClient.rpc.putBlob({
          account: account.address,
          blobData: assetUpload.stream,
          blobName: publishIntent.assetBlobName,
          totalBytes: assetUpload.ciphertextSize,
        }),
        shelbyClient.rpc.putBlob({
          account: account.address,
          blobData: manifestUpload.stream,
          blobName: publishIntent.manifestBlobName,
          totalBytes: manifestUpload.ciphertextSize,
        }),
      ]);

      const finalizedAsset = await finalizePublishedAsset({
        assetEncryptionKey: encodePrimeGateBase64Url(contentKey),
        attestationToken: publishIntent.attestationToken,
      });

      let publishedAsset = finalizedAsset;

      if (normalizedPriceApt !== "0") {
        try {
          const listingOptions = await getPrimeGateTransactionOptions(10_000);
          const listingTransaction = await signAndSubmitTransaction({
            data: {
              function: getPrimeGateRegistryFunctionId(PRIMEGATE_REGISTRY_CONTRACT_ADDRESS, "upsert_listing"),
              functionArguments: [
                encodePrimeGatePackageId(finalizedAsset.id),
                parseAptAmountToOctas(normalizedPriceApt).toString(),
              ],
            },
            options: listingOptions,
            sender: account.address,
          });

          await waitForPrimeGateTransaction(listingTransaction.hash);
          publishedAsset = await syncPublishedAssetListing(finalizedAsset.id);

          if (publishedAsset.listingStatus !== "active") {
            throw new Error(publishedAsset.listingError ?? "The on-chain listing could not be confirmed.");
          }
        } catch (listingError) {
          const reason = listingError instanceof Error ? listingError.message : "listing confirmation failed";
          throw new Error(
            `The asset was uploaded and registered, but its paid listing needs attention. ${reason} Retry it from Releases.`,
          );
        }
      }

      return {
        assetBlobName: publishedAsset.assetBlobName,
        assetSha256: publishedAsset.assetSha256,
        encrypted: publishedAsset.encrypted,
        createdAt: publishedAsset.createdAt,
        id: publishedAsset.id,
        keywords: publishedAsset.keywords,
        license: publishedAsset.license,
        listingError: publishedAsset.listingError,
        listingStatus: publishedAsset.listingStatus,
        manifestBlobName: publishedAsset.manifestBlobName,
        mimeType: publishedAsset.mimeType,
        ownerAddress: publishedAsset.ownerAddress,
        originalFileName: publishedAsset.originalFileName,
        packageHandle: publishedAsset.packageHandle,
        packageSlug: publishedAsset.packageSlug,
        price: publishedAsset.price,
        readmeMarkdown: publishedAsset.readmeMarkdown,
        releaseChannel: publishedAsset.releaseChannel,
        releaseNotes: publishedAsset.releaseNotes,
        sizeBytes: publishedAsset.sizeBytes,
        title: publishedAsset.title,
        version: publishedAsset.version,
      } satisfies PublishedAssetResult;
    } catch (publishError) {
      const nextError =
        publishError instanceof Error ? publishError.message : "Shelby publish failed.";
      setError(nextError);
      throw publishError;
    } finally {
      setIsPublishingAsset(false);
      if (address) {
        void queryClient.invalidateQueries({
          queryKey: ["primegate", "publisher-billing", address.toLowerCase()],
        });
      }
    }
  };

  const retryPublishedAssetListing = async (asset: { id: string; price: number }) => {
    if (!address || !account?.address) {
      throw new Error("Connect an Aptos wallet before retrying the listing.");
    }

    if (isWrongNetwork) {
      throw new Error(`Switch your wallet to ${requiredNetworkName} before retrying the listing.`);
    }

    setRetryingListingId(asset.id);
    setError(null);

    try {
      await ensurePrimeGateSession();
      const listingOptions = await getPrimeGateTransactionOptions(10_000);
      const listingTransaction = await signAndSubmitTransaction({
        data: {
          function: getPrimeGateRegistryFunctionId(PRIMEGATE_REGISTRY_CONTRACT_ADDRESS, "upsert_listing"),
          functionArguments: [
            encodePrimeGatePackageId(asset.id),
            parseAptAmountToOctas(asset.price).toString(),
          ],
        },
        options: listingOptions,
        sender: account.address,
      });

      await waitForPrimeGateTransaction(listingTransaction.hash);
      const syncedAsset = await syncPublishedAssetListing(asset.id);

      if (syncedAsset.listingStatus !== "active") {
        throw new Error(syncedAsset.listingError ?? "The on-chain listing could not be confirmed.");
      }

      await queryClient.invalidateQueries({
        queryKey: ["primegate", "published-assets", address],
      });
      return syncedAsset;
    } catch (retryError) {
      const nextError = retryError instanceof Error ? retryError.message : "Listing retry failed.";
      setError(nextError);
      throw retryError;
    } finally {
      setRetryingListingId(null);
    }
  };

  return {
    canPublish,
    error,
    isPublishing: isPublishingAsset || retryingListingId !== null,
    publishAsset,
    retryPublishedAssetListing,
    retryingListingId,
  };
}
