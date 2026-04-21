import { useMemo, useState } from "react";
import { useEncodeBlobs, useRegisterCommitments } from "@shelby-protocol/react";

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
import { encodePrimeGatePackageId, getPrimeGateRegistryFunctionId } from "@/lib/primegate-registry-contract";
import {
  finalizePublishedAsset,
  requestPublishIntent,
} from "@/lib/registry-api";

type PublishAssetArgs = {
  description: string;
  file: File;
  packageSlug: string;
  priceApt: string;
  releaseVersion: string;
  title: string;
};

type PrimeGatePublishedManifest = {
  assetBlobName: string;
  assetSha256: string;
  createdAt: string;
  description: string;
  manifestBlobName: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  packageSlug: string;
  priceApt: string;
  publishAttestation: string;
  publishIntentId: string;
  releaseVersion: string;
  sizeBytes: number;
  source: "primegate";
  title: string;
  version: 1;
};

export type PublishedAssetResult = {
  assetBlobName: string;
  createdAt: string;
  id: string;
  manifestBlobName: string;
  mimeType: string;
  ownerAddress: string;
  originalFileName: string;
  packageHandle: string;
  packageSlug: string;
  price: number;
  sizeBytes: number;
  title: string;
  version: string;
};

function toHex(bytes: Uint8Array) {
  return `0x${Array.from(bytes, (entry) => entry.toString(16).padStart(2, "0")).join("")}`;
}

async function sha256Hex(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

export function useShelbyPublish() {
  const [error, setError] = useState<string | null>(null);
  const [isUploadingToShelbyRpc, setIsUploadingToShelbyRpc] = useState(false);
  const { account, address, ensurePrimeGateSession, signAndSubmitTransaction } = usePrimeGateWallet();
  const encodeBlobs = useEncodeBlobs({
    client: shelbyClient,
  });
  const registerCommitments = useRegisterCommitments({
    client: shelbyClient,
  });

  const canPublish = useMemo(
    () => Boolean(account?.address && signAndSubmitTransaction),
    [account?.address, signAndSubmitTransaction],
  );

  const publishAsset = async ({
    description,
    file,
    packageSlug,
    priceApt,
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

    try {
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      const mimeType = file.type || "application/octet-stream";
      const assetSha256 = await sha256Hex(fileBytes);
      const normalizedPackageSlug = normalizePrimeGatePackageSlug(packageSlug);
      const normalizedPriceApt = normalizeAptAmount(priceApt);
      const normalizedReleaseVersion = normalizePrimeGateReleaseVersion(releaseVersion);

      await ensurePrimeGateSession();

      const publishIntent = await requestPublishIntent({
        assetSha256,
        description,
        mimeType,
        originalFileName: file.name,
        packageSlug: normalizedPackageSlug,
        priceApt: normalizedPriceApt,
        releaseVersion: normalizedReleaseVersion,
        sizeBytes: file.size,
        title,
      });

      const manifest: PrimeGatePublishedManifest = {
        assetBlobName: publishIntent.assetBlobName,
        assetSha256,
        createdAt: publishIntent.createdAt,
        description,
        manifestBlobName: publishIntent.manifestBlobName,
        mimeType,
        originalFileName: file.name,
        ownerAddress: address,
        packageSlug: normalizedPackageSlug,
        priceApt: normalizedPriceApt,
        publishAttestation: publishIntent.attestationToken,
        publishIntentId: publishIntent.id,
        releaseVersion: normalizedReleaseVersion,
        sizeBytes: file.size,
        source: "primegate",
        title,
        version: 1,
      };

      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
      const shelbyBuildOptions = await getPrimeGateTransactionOptions(50_000);
      const shelbyExpirationMicros = Date.now() * 1000 + PRIMEGATE_DEFAULT_BLOB_TTL_MICROS;
      const shelbyBlobs = [
        {
          blobData: fileBytes,
          blobName: publishIntent.assetBlobName,
        },
        {
          blobData: manifestBytes,
          blobName: publishIntent.manifestBlobName,
        },
      ] as const;

      const encodedCommitments = await encodeBlobs.mutateAsync({
        blobs: shelbyBlobs.map((blob) => ({
          blobData: blob.blobData,
          blobName: blob.blobName,
        })),
      });

      const pendingRegisterBlobTransaction = await registerCommitments.mutateAsync({
        commitments: shelbyBlobs.map((blob, index) => ({
          blobName: blob.blobName,
          commitment: encodedCommitments[index],
        })),
        expirationMicros: shelbyExpirationMicros,
        options: {
          build: {
            options: shelbyBuildOptions,
          },
        },
        signer: {
          account: account.address,
          signAndSubmitTransaction,
        },
      });

      await waitForPrimeGateTransaction(pendingRegisterBlobTransaction.hash);

      setIsUploadingToShelbyRpc(true);
      try {
        await Promise.all(
          shelbyBlobs.map((blob) =>
            shelbyClient.rpc.putBlob({
              account: account.address,
              blobData: blob.blobData,
              blobName: blob.blobName,
            }),
          ),
        );
      } finally {
        setIsUploadingToShelbyRpc(false);
      }

      const finalizedAsset = await finalizePublishedAsset({
        attestationToken: publishIntent.attestationToken,
      });

      if (normalizedPriceApt !== "0") {
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
      }

      return {
        assetBlobName: finalizedAsset.assetBlobName,
        createdAt: finalizedAsset.createdAt,
        id: finalizedAsset.id,
        manifestBlobName: finalizedAsset.manifestBlobName,
        mimeType: finalizedAsset.mimeType,
        ownerAddress: finalizedAsset.ownerAddress,
        originalFileName: finalizedAsset.originalFileName,
        packageHandle: finalizedAsset.packageHandle,
        packageSlug: finalizedAsset.packageSlug,
        price: finalizedAsset.price,
        sizeBytes: finalizedAsset.sizeBytes,
        title: finalizedAsset.title,
        version: finalizedAsset.version,
      } satisfies PublishedAssetResult;
    } catch (publishError) {
      const nextError =
        publishError instanceof Error ? publishError.message : "Shelby publish failed.";
      setError(nextError);
      throw publishError;
    }
  };

  return {
    canPublish,
    error,
    isPublishing: encodeBlobs.isPending || registerCommitments.isPending || isUploadingToShelbyRpc,
    publishAsset,
  };
}
