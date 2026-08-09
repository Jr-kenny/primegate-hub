import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  ShelbyBlobClient,
} from "@shelby-protocol/sdk/browser";
import { AccountAddress, Aptos, AptosConfig } from "@aptos-labs/ts-sdk";

import { PRIMEGATE_REGISTRY_CONTRACT_ADDRESS } from "@/config/primegate-registry";
import {
  PRIMEGATE_DEFAULT_BLOB_TTL_MICROS,
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_SHELBY_API_KEY,
  PRIMEGATE_SHELBY_BASE_URL,
} from "@/config/web3-constants";
import { shelbyClient } from "@/config/web3";
import { usePrimeGateWallet } from "@/hooks/usePrimeGateWallet";
import { getPrimeGateTransactionOptions, waitForPrimeGateTransaction } from "@/lib/aptos-client";
import { normalizeAptAmount, parseAptAmountToOctas } from "@/lib/aptos-amount";
import { assertPrimeGateShelbyRpcReachable } from "@/lib/primegate-shelby-rpc";
import {
  withPrimeGatePublishStage,
  getPrimeGatePublishErrorMessage,
} from "@/lib/primegate-publish-error";
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
  fetchPrimeGateShelbySponsorConfig,
  finalizePublishedAsset,
  requestPublishIntent,
  syncPublishedAssetListing,
  submitPrimeGateShelbySponsorTransaction,
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

type PrimeGateShelbySponsorConfig = Awaited<ReturnType<typeof fetchPrimeGateShelbySponsorConfig>>;

function assertSponsorServiceAvailable(sponsorConfig: PrimeGateShelbySponsorConfig) {
  if (sponsorConfig.status === "not-configured") {
    throw new Error("The PrimeGate sponsor service is not configured. Publishing is unavailable.");
  }

  if (sponsorConfig.status === "unavailable") {
    throw new Error("The PrimeGate sponsor service is unavailable. Publishing is unavailable.");
  }

  if (!sponsorConfig.enabled || !sponsorConfig.sponsorAddress) {
    throw new Error("The PrimeGate sponsor service is not ready. Publishing is unavailable.");
  }
}

function assertSponsorAccountIsDistinctFromPublisher(
  publisherAddress: string | AccountAddress,
  sponsorAddress: AccountAddress,
) {
  if (AccountAddress.from(publisherAddress).equals(sponsorAddress)) {
    throw new Error("The PrimeGate sponsor account must be different from the publishing wallet.");
  }
}

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
    signTransaction,
  } = usePrimeGateWallet();
  const canPublish = useMemo(
    () => Boolean(account?.address && signTransaction),
    [account?.address, signTransaction],
  );

  const submitPrimeGateListingTransaction = async ({
    packageId,
    priceApt,
    sponsorConfig,
  }: {
    packageId: string;
    priceApt: string | number;
    sponsorConfig: Awaited<ReturnType<typeof fetchPrimeGateShelbySponsorConfig>>;
  }) => {
    if (!account?.address) {
      throw new Error("Connect an Aptos wallet before publishing a listing.");
    }

    assertSponsorServiceAvailable(sponsorConfig);

    const listingOptions = await getPrimeGateTransactionOptions(10_000);
    const listingData = {
      function: getPrimeGateRegistryFunctionId(PRIMEGATE_REGISTRY_CONTRACT_ADDRESS, "upsert_listing"),
      functionArguments: [
        encodePrimeGatePackageId(packageId),
        parseAptAmountToOctas(priceApt).toString(),
      ],
    };

    const aptos = new Aptos(new AptosConfig({ network: PRIMEGATE_APTOS_NETWORK }));
    const sponsorAddress = AccountAddress.from(sponsorConfig.sponsorAddress);
    assertSponsorAccountIsDistinctFromPublisher(account.address, sponsorAddress);
    const sponsoredTransaction = await withPrimeGatePublishStage(
      "Shelby transaction preparation",
      () =>
        aptos.transaction.build.simple({
          data: listingData,
          options: listingOptions,
          sender: AccountAddress.from(account.address),
          withFeePayer: true,
        }),
    );

    sponsoredTransaction.feePayerAddress = sponsorAddress;
    const signedTransaction = await withPrimeGatePublishStage("wallet signature", () =>
      signTransaction({
        transactionOrPayload: sponsoredTransaction,
      }),
    );

    return withPrimeGatePublishStage("sponsor submission", () =>
      submitPrimeGateShelbySponsorTransaction({
        expectedPackageId: packageId,
        expectedPriceOctas: parseAptAmountToOctas(priceApt).toString(),
        operation: "primegate-listing",
        senderAuthenticatorHex: signedTransaction.authenticator.bcsToHex().toString(),
        transactionHex: sponsoredTransaction.bcsToHex().toString(),
        walletAddress: AccountAddress.from(account.address).toStringLong(),
      }),
    );
  };

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
      await withPrimeGatePublishStage("Shelby RPC preflight", () =>
        assertPrimeGateShelbyRpcReachable(PRIMEGATE_SHELBY_BASE_URL, PRIMEGATE_SHELBY_API_KEY),
      );

      const mimeType = file.type || "application/octet-stream";
      const normalizedPackageSlug = normalizePrimeGatePackageSlug(packageSlug);
      const normalizedPriceApt = normalizeAptAmount(priceApt);
      const normalizedReleaseVersion = normalizePrimeGateReleaseVersion(releaseVersion);

      await withPrimeGatePublishStage("wallet session", () => ensurePrimeGateSession());

      const publishIntent = await withPrimeGatePublishStage("publish intent", () =>
        requestPublishIntent({
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
        }),
      );

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
      const [assetCommitments, manifestCommitments] = await withPrimeGatePublishStage(
        "Shelby commitments",
        () =>
          Promise.all([
            generateCommitments(provider, assetEncryption.stream),
            generateCommitments(provider, manifestEncryption.stream),
          ]),
      );

      if (assetCommitments.raw_data_size !== assetEncryption.ciphertextSize) {
        throw new Error("PrimeGate encrypted asset size did not match Shelby commitment size.");
      }

      if (manifestCommitments.raw_data_size !== manifestEncryption.ciphertextSize) {
        throw new Error("PrimeGate encrypted manifest size did not match Shelby commitment size.");
      }
      const shelbyBuildOptions = await getPrimeGateTransactionOptions(50_000);
      const shelbyExpirationMicros = Date.now() * 1000 + PRIMEGATE_DEFAULT_BLOB_TTL_MICROS;
      const sponsorConfig = await withPrimeGatePublishStage(
        "Shelby sponsor configuration",
        () => fetchPrimeGateShelbySponsorConfig(),
      );
      assertSponsorServiceAvailable(sponsorConfig);
      const blobRegistration = {
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
      };

      const aptos = new Aptos(new AptosConfig({ network: PRIMEGATE_APTOS_NETWORK }));
      const sponsorAddress = AccountAddress.from(sponsorConfig.sponsorAddress);
      assertSponsorAccountIsDistinctFromPublisher(account.address, sponsorAddress);
      const sponsoredTransaction = await withPrimeGatePublishStage(
        "Shelby transaction preparation",
        () =>
          aptos.transaction.build.multiAgent({
            data: ShelbyBlobClient.createBatchRegisterBlobsPayload({
              ...blobRegistration,
              useSponsoredUsdVariant: true,
            }),
            options: shelbyBuildOptions,
            secondarySignerAddresses: [sponsorAddress],
            sender: AccountAddress.from(account.address),
            withFeePayer: true,
          }),
      );

      sponsoredTransaction.feePayerAddress = sponsorAddress;
      const signedTransaction = await withPrimeGatePublishStage("wallet signature", () =>
        signTransaction({
          transactionOrPayload: sponsoredTransaction,
        }),
      );
      const pendingShelbyRegistration = await withPrimeGatePublishStage("sponsor submission", () =>
        submitPrimeGateShelbySponsorTransaction({
          attestationToken: publishIntent.attestationToken,
          operation: "shelby-registration",
          senderAuthenticatorHex: signedTransaction.authenticator.bcsToHex().toString(),
          transactionHex: sponsoredTransaction.bcsToHex().toString(),
          walletAddress: address,
        }),
      );

      await withPrimeGatePublishStage("Shelby registration confirmation", () =>
        waitForPrimeGateTransaction(pendingShelbyRegistration.hash),
      );
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
      await withPrimeGatePublishStage("Shelby blob upload", () =>
        Promise.all([
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
        ]),
      );

      const finalizedAsset = await withPrimeGatePublishStage("PrimeGate finalization", () =>
        finalizePublishedAsset({
          assetEncryptionKey: encodePrimeGateBase64Url(contentKey),
          attestationToken: publishIntent.attestationToken,
        }),
      );

      let publishedAsset = finalizedAsset;

      if (normalizedPriceApt !== "0") {
        try {
          const listingTransaction = await submitPrimeGateListingTransaction({
            packageId: finalizedAsset.id,
            priceApt: normalizedPriceApt,
            sponsorConfig,
          });

          await withPrimeGatePublishStage("paid listing", () =>
            waitForPrimeGateTransaction(listingTransaction.hash),
          );
          publishedAsset = await withPrimeGatePublishStage("paid listing", () =>
            syncPublishedAssetListing(finalizedAsset.id),
          );

          if (publishedAsset.listingStatus !== "active") {
            throw new Error(publishedAsset.listingError ?? "The on-chain listing could not be confirmed.");
          }
        } catch (listingError) {
          const reason = getPrimeGatePublishErrorMessage(listingError);
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
        publishError instanceof Error
          ? publishError
          : new Error(getPrimeGatePublishErrorMessage(publishError));
      setError(nextError.message);
      throw nextError;
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
      await withPrimeGatePublishStage("wallet session", () => ensurePrimeGateSession());
      const sponsorConfig = await withPrimeGatePublishStage(
        "Shelby sponsor configuration",
        () => fetchPrimeGateShelbySponsorConfig(),
      );
      assertSponsorServiceAvailable(sponsorConfig);
      const listingTransaction = await submitPrimeGateListingTransaction({
        packageId: asset.id,
        priceApt: asset.price,
        sponsorConfig,
      });

      await withPrimeGatePublishStage("paid listing", () =>
        waitForPrimeGateTransaction(listingTransaction.hash),
      );
      const syncedAsset = await withPrimeGatePublishStage("paid listing", () =>
        syncPublishedAssetListing(asset.id),
      );

      if (syncedAsset.listingStatus !== "active") {
        throw new Error(syncedAsset.listingError ?? "The on-chain listing could not be confirmed.");
      }

      await queryClient.invalidateQueries({
        queryKey: ["primegate", "published-assets", address],
      });
      return syncedAsset;
    } catch (retryError) {
      const nextError =
        retryError instanceof Error
          ? retryError
          : new Error(getPrimeGatePublishErrorMessage(retryError));
      setError(nextError.message);
      throw nextError;
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
