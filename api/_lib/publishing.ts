import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AccountAddress } from "@aptos-labs/ts-sdk";

import { AuthError } from "./auth.js";
import { savePublishedAsset } from "./catalog.js";
import {
  assertPrimeGateContentEncryptionManifest,
  hashPrimeGateEncryptedBlob,
  openPrimeGateDecryptedBlobStream,
  readPrimeGateEncryptedBlobBytes,
  wrapPrimeGateContentKey,
} from "./content-encryption.js";
import { getShelbyClient } from "./shelby.js";
import { normalizeAptAmount } from "../../src/lib/aptos-amount.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";
import type { PrimeGateContentEncryptionManifest } from "../../src/lib/primegate-content-encryption.js";
import {
  PRIMEGATE_RELEASE_CHANNELS,
  normalizePrimeGatePackageSlug,
  normalizePrimeGateReleaseChannel,
  normalizePrimeGateReleaseVersion,
} from "../../src/lib/primegate-package.js";

const PRIMEGATE_PUBLISH_SOURCE = "primegate";
const PRIMEGATE_PUBLISH_VERSION = 1;
const PRIMEGATE_PUBLISH_INTENT_TTL_MS = 1000 * 60 * 10;

const createPublishIntentSchema = z.object({
  assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/).optional(),
  description: z.string().min(1),
  keywords: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  license: z.string().trim().min(1).max(128).default("Custom"),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  readmeMarkdown: z.string().max(50_000).default(""),
  releaseChannel: z.enum(PRIMEGATE_RELEASE_CHANNELS).default("latest"),
  releaseNotes: z.string().max(10_000).default(""),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  title: z.string().min(1),
});

const finalizePublishedAssetSchema = z.object({
  assetEncryptionKey: z.string().min(1),
  attestationToken: z.string().min(1),
});

const publishIntentClaimsSchema = createPublishIntentSchema.extend({
  assetBlobName: z.string().min(1),
  createdAt: z.string().datetime(),
  exp: z.number().int().positive(),
  iat: z.number().int().positive(),
  id: z.string().uuid(),
  manifestBlobName: z.string().min(1),
  ownerAddress: z.string().min(1),
});

const strictPublishedManifestSchema = z.object({
  assetBlobName: z.string().min(1),
  assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/).optional(),
  createdAt: z.string().datetime(),
  description: z.string().min(1),
  encryption: z.object({
    algorithm: z.literal("AES-256-GCM-CHUNKED"),
    asset: z.object({ nonce: z.string().min(1) }),
    chunkSize: z.number().int().positive(),
    headerBytes: z.literal(64),
    manifest: z.object({ nonce: z.string().min(1) }),
    tagBytes: z.literal(16),
    version: z.literal(1),
  }),
  keywords: z.array(z.string().trim().min(1).max(64)).max(20).default([]),
  license: z.string().trim().min(1).max(128).default("Custom"),
  manifestBlobName: z.string().min(1),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  ownerAddress: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  publishAttestation: z.string().min(1),
  publishIntentId: z.string().uuid(),
  readmeMarkdown: z.string().max(50_000).default(""),
  releaseChannel: z.enum(PRIMEGATE_RELEASE_CHANNELS).default("latest"),
  releaseNotes: z.string().max(10_000).default(""),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  source: z.literal(PRIMEGATE_PUBLISH_SOURCE),
  title: z.string().min(1),
  version: z.literal(PRIMEGATE_PUBLISH_VERSION),
});

const legacyPublishedManifestSchema = z
  .object({
    assetBlobName: z.string().min(1),
    assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/).optional(),
    createdAt: z.string().datetime(),
    description: z.string().min(1),
    manifestBlobName: z.string().min(1),
    mimeType: z.string().min(1),
    originalFileName: z.string().min(1),
    ownerAddress: z.string().min(1),
    price: z.union([z.number(), z.string().min(1)]),
    publishAttestation: z.string().min(1),
    publishIntentId: z.string().uuid(),
    sizeBytes: z.number().int().min(0),
    source: z.literal(PRIMEGATE_PUBLISH_SOURCE),
    title: z.string().min(1),
    version: z.literal(PRIMEGATE_PUBLISH_VERSION),
  })
  .passthrough();

export type PrimeGatePublishedManifest = Omit<
  z.infer<typeof strictPublishedManifestSchema>,
  | "encryption"
  | "keywords"
  | "license"
  | "packageSlug"
  | "readmeMarkdown"
  | "releaseChannel"
  | "releaseNotes"
  | "releaseVersion"
> & {
  encryption?: PrimeGateContentEncryptionManifest;
  keywords?: string[];
  license?: string;
  packageSlug: string | null;
  price?: number | string;
  readmeMarkdown?: string;
  releaseChannel?: string;
  releaseNotes?: string;
  releaseVersion: string | null;
};

function getPublishSecret() {
  const secret = readPrimeGateEnvValue(process.env.PRIMEGATE_PUBLISH_SECRET);

  if (!secret) {
    throw new Error("PRIMEGATE_PUBLISH_SECRET is not configured.");
  }

  return secret;
}

function assertConfiguredUploadLimit(sizeBytes: number) {
  const rawLimit = readPrimeGateEnvValue(process.env.PRIMEGATE_MAX_UPLOAD_BYTES);
  if (!rawLimit) {
    return;
  }

  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit <= 0) {
    throw new Error("PRIMEGATE_MAX_UPLOAD_BYTES must be a positive integer when configured.");
  }

  if (sizeBytes > limit) {
    throw new AuthError(`PrimeGate upload exceeds the configured ${limit}-byte limit.`, 400);
  }
}

function normalizeWalletAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function signPublishValue(value: string) {
  return createHmac("sha256", getPublishSecret())
    .update(`primegate-publish:${value}`)
    .digest("base64url");
}

function createPublishAttestationToken(claims: z.infer<typeof publishIntentClaimsSchema>) {
  const payload = Buffer.from(JSON.stringify(claims), "utf8").toString("base64url");
  return `${payload}.${signPublishValue(payload)}`;
}

function verifyPublishAttestationToken(token: string) {
  const [payload, signature] = token.split(".");

  if (!payload || !signature) {
    throw new AuthError("Publish attestation is malformed.", 400);
  }

  const expectedSignature = signPublishValue(payload);
  const actual = Buffer.from(signature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new AuthError("Publish attestation signature is invalid.", 401);
  }

  const claims = publishIntentClaimsSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );

  assertConfiguredUploadLimit(claims.sizeBytes);

  if (claims.exp <= Date.now()) {
    throw new AuthError("Publish attestation has expired.", 401);
  }

  return claims;
}

async function readShelbyBlobBytes(account: string, blobName: string) {
  const blob = await getShelbyClient().download({
    account,
    blobName,
  });
  const chunks: Uint8Array[] = [];

  for await (const chunk of blob.readable) {
    if (typeof chunk === "string") {
      chunks.push(Buffer.from(chunk, "utf8"));
      continue;
    }

    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

export async function readPublishedManifest(
  ownerAddress: string,
  manifestBlobName: string,
  options: {
    contentKey?: Uint8Array;
    expectedEncryption?: PrimeGateContentEncryptionManifest;
    expectedPlaintextSize?: number;
  } = {},
): Promise<PrimeGatePublishedManifest> {
  if (options.expectedEncryption && !options.contentKey) {
    throw new AuthError("PrimeGate manifest encryption metadata requires a content key.", 500);
  }

  if (options.expectedEncryption) {
    assertPrimeGateContentEncryptionManifest(options.expectedEncryption);
  }

  const manifestBytes = options.contentKey
    ? await readPrimeGateEncryptedBlobBytes(
        (range) =>
          getShelbyClient().download({
            account: ownerAddress,
            blobName: manifestBlobName,
            range,
          }),
        options.contentKey,
        "manifest",
        {
          expectedNonce: options.expectedEncryption?.manifest.nonce,
          expectedPlaintextSize: options.expectedPlaintextSize,
        },
      )
    : await readShelbyBlobBytes(ownerAddress, manifestBlobName);
  let rawManifest: unknown;

  try {
    rawManifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new AuthError("Published manifest is invalid.", 400);
  }

  try {
    return strictPublishedManifestSchema.parse(rawManifest) as PrimeGatePublishedManifest;
  } catch {
    try {
      const legacyManifest = legacyPublishedManifestSchema.parse(rawManifest);
      const normalizedManifest: PrimeGatePublishedManifest = {
        ...legacyManifest,
        packageSlug: null,
        priceApt: normalizeAptAmount(String(legacyManifest.price)),
        releaseVersion: null,
      };
      return normalizedManifest;
    } catch {
      throw new AuthError("Published manifest is invalid.", 400);
    }
  }
}

async function openShelbyBlobStream(
  ownerAddress: string,
  blobName: string,
  range?: { end?: number; start: number },
) {
  const blob = await getShelbyClient().download({
    account: ownerAddress,
    blobName,
    range,
  });
  const iterator = (blob.readable as AsyncIterable<Uint8Array | string>)[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async cancel() {
      await iterator.return?.();
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }

        controller.enqueue(
          typeof next.value === "string" ? new TextEncoder().encode(next.value) : next.value,
        );
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export function openPublishedAssetStream(
  ownerAddress: string,
  assetBlobName: string,
  range?: { end?: number; start: number },
  options: {
    contentKey?: Uint8Array;
    encryption?: PrimeGateContentEncryptionManifest;
    expectedPlaintextSize?: number;
  } = {},
) {
  if (options.encryption && !options.contentKey) {
    throw new AuthError("PrimeGate asset encryption metadata requires a content key.", 500);
  }

  if (options.contentKey && options.encryption) {
    assertPrimeGateContentEncryptionManifest(options.encryption);

    if (range && range.end === undefined) {
      throw new AuthError("PrimeGate encrypted ranges require an explicit end offset.", 500);
    }

    return openPrimeGateDecryptedBlobStream(
      (blobRange) =>
        getShelbyClient().download({
          account: ownerAddress,
          blobName: assetBlobName,
          range: blobRange,
        }),
      options.contentKey,
      "asset",
      {
        encryption: options.encryption,
        expectedNonce: options.encryption.asset.nonce,
        expectedPlaintextSize: options.expectedPlaintextSize,
        range: range ? { end: range.end as number, start: range.start } : undefined,
      },
    );
  }

  return openShelbyBlobStream(ownerAddress, assetBlobName, range);
}

function assertIntentMatchesManifest(
  claims: z.infer<typeof publishIntentClaimsSchema>,
  manifest: PrimeGatePublishedManifest,
) {
  if (!manifest.packageSlug) {
    throw new AuthError("Published manifest package slug is missing.", 400);
  }

  if (!manifest.encryption) {
    throw new AuthError("Published manifest does not contain PrimeGate content encryption metadata.", 400);
  }

  try {
    assertPrimeGateContentEncryptionManifest(manifest.encryption);
  } catch {
    throw new AuthError("Published manifest encryption metadata is invalid.", 400);
  }

  if (!manifest.releaseVersion) {
    throw new AuthError("Published manifest release version is missing.", 400);
  }

  if (normalizeWalletAddress(manifest.ownerAddress) !== claims.ownerAddress) {
    throw new AuthError("Published manifest owner does not match the PrimeGate intent.", 400);
  }

  if (manifest.publishIntentId !== claims.id) {
    throw new AuthError("Published manifest intent id does not match the PrimeGate intent.", 400);
  }

  if (manifest.assetBlobName !== claims.assetBlobName) {
    throw new AuthError("Published manifest asset blob name does not match the PrimeGate intent.", 400);
  }

  if (manifest.manifestBlobName !== claims.manifestBlobName) {
    throw new AuthError("Published manifest blob name does not match the PrimeGate intent.", 400);
  }

  if (manifest.assetSha256 && claims.assetSha256 && manifest.assetSha256 !== claims.assetSha256) {
    throw new AuthError("Published manifest asset hash does not match the PrimeGate intent.", 400);
  }

  if (manifest.title !== claims.title) {
    throw new AuthError("Published manifest title does not match the PrimeGate intent.", 400);
  }

  if (manifest.license !== claims.license) {
    throw new AuthError("Published manifest license does not match the PrimeGate intent.", 400);
  }

  if (JSON.stringify(manifest.keywords) !== JSON.stringify(claims.keywords)) {
    throw new AuthError("Published manifest keywords do not match the PrimeGate intent.", 400);
  }

  if (manifest.readmeMarkdown !== claims.readmeMarkdown) {
    throw new AuthError("Published manifest README does not match the PrimeGate intent.", 400);
  }

  if (manifest.releaseNotes !== claims.releaseNotes) {
    throw new AuthError("Published manifest release notes do not match the PrimeGate intent.", 400);
  }

  if (manifest.releaseChannel !== claims.releaseChannel) {
    throw new AuthError("Published manifest release channel does not match the PrimeGate intent.", 400);
  }

  if (manifest.description !== claims.description) {
    throw new AuthError("Published manifest description does not match the PrimeGate intent.", 400);
  }

  if (normalizeAptAmount(manifest.priceApt) !== claims.priceApt) {
    throw new AuthError("Published manifest price does not match the PrimeGate intent.", 400);
  }

  if (manifest.originalFileName !== claims.originalFileName) {
    throw new AuthError("Published manifest file name does not match the PrimeGate intent.", 400);
  }

  if (manifest.mimeType !== claims.mimeType) {
    throw new AuthError("Published manifest MIME type does not match the PrimeGate intent.", 400);
  }

  if (normalizePrimeGatePackageSlug(manifest.packageSlug) !== claims.packageSlug) {
    throw new AuthError("Published manifest package slug does not match the PrimeGate intent.", 400);
  }

  if (normalizePrimeGateReleaseVersion(manifest.releaseVersion) !== claims.releaseVersion) {
    throw new AuthError("Published manifest release version does not match the PrimeGate intent.", 400);
  }

  if (manifest.sizeBytes !== claims.sizeBytes) {
    throw new AuthError("Published manifest size does not match the PrimeGate intent.", 400);
  }

  if (manifest.createdAt !== claims.createdAt) {
    throw new AuthError("Published manifest timestamp does not match the PrimeGate intent.", 400);
  }

  if (manifest.publishAttestation !== createPublishAttestationToken(claims)) {
    throw new AuthError("Published manifest attestation does not match the PrimeGate intent.", 400);
  }
}

export function createPublishIntent(ownerAddress: string, input: unknown) {
  const parsedInput = createPublishIntentSchema.parse(input);
  assertConfiguredUploadLimit(parsedInput.sizeBytes);
  const parsed = {
    ...parsedInput,
    packageSlug: normalizePrimeGatePackageSlug(parsedInput.packageSlug),
    priceApt: normalizeAptAmount(parsedInput.priceApt),
    releaseChannel: normalizePrimeGateReleaseChannel(parsedInput.releaseChannel),
    releaseVersion: normalizePrimeGateReleaseVersion(parsedInput.releaseVersion),
  };
  const normalizedOwnerAddress = normalizeWalletAddress(ownerAddress);
  const issuedAt = Date.now();
  const id = randomUUID();
  const createdAt = new Date(issuedAt).toISOString();
  const expiresAt = issuedAt + PRIMEGATE_PUBLISH_INTENT_TTL_MS;

  const claims = publishIntentClaimsSchema.parse({
    ...parsed,
    assetBlobName: `primegate/content/${id}/asset.bin`,
    createdAt,
    exp: expiresAt,
    iat: issuedAt,
    id,
    manifestBlobName: `primegate/content/${id}/manifest.bin`,
    ownerAddress: normalizedOwnerAddress,
  });

  return {
    assetBlobName: claims.assetBlobName,
    attestationToken: createPublishAttestationToken(claims),
    createdAt: claims.createdAt,
    expiresAt: new Date(claims.exp).toISOString(),
    id: claims.id,
    manifestBlobName: claims.manifestBlobName,
    ownerAddress: claims.ownerAddress,
  };
}

export async function finalizePublishedAsset(ownerAddress: string, input: unknown) {
  const { assetEncryptionKey, attestationToken } = finalizePublishedAssetSchema.parse(input);
  const claims = verifyPublishAttestationToken(attestationToken);
  const normalizedOwnerAddress = normalizeWalletAddress(ownerAddress);

  let contentKey: Buffer;
  try {
    contentKey = Buffer.from(assetEncryptionKey, "base64url");
    if (contentKey.byteLength !== 32) {
      throw new Error("invalid content key length");
    }
  } catch {
    throw new AuthError("PrimeGate publish content key is invalid.", 400);
  }

  if (claims.ownerAddress !== normalizedOwnerAddress) {
    throw new AuthError("Publish attestation does not match the authenticated wallet.", 401);
  }

  const shelby = getShelbyClient();
  const [assetMetadata, manifestMetadata] = await Promise.all([
    shelby.coordination.getBlobMetadata({
      account: claims.ownerAddress,
      name: claims.assetBlobName,
    }),
    shelby.coordination.getBlobMetadata({
      account: claims.ownerAddress,
      name: claims.manifestBlobName,
    }),
  ]);

  if (!assetMetadata?.isWritten) {
    throw new AuthError("PrimeGate could not verify the uploaded asset on Shelby.", 400);
  }

  if (!manifestMetadata?.isWritten) {
    throw new AuthError("PrimeGate could not verify the uploaded manifest on Shelby.", 400);
  }

  const manifest = await readPublishedManifest(claims.ownerAddress, claims.manifestBlobName, {
    contentKey,
  });

  assertIntentMatchesManifest(claims, manifest);

  if (!manifest.encryption) {
    throw new AuthError("PrimeGate publish manifest is missing content encryption metadata.", 400);
  }

  const assetDownload = (range?: { end: number; start: number }) =>
    shelby.download({
      account: claims.ownerAddress,
      blobName: claims.assetBlobName,
      range,
    });
  const manifestDownload = (range?: { end: number; start: number }) =>
    shelby.download({
      account: claims.ownerAddress,
      blobName: claims.manifestBlobName,
      range,
    });

  const assetStats = await hashPrimeGateEncryptedBlob(assetDownload, contentKey, "asset", {
    expectedNonce: manifest.encryption.asset.nonce,
    expectedPlaintextSize: claims.sizeBytes,
  });
  const manifestStats = await hashPrimeGateEncryptedBlob(manifestDownload, contentKey, "manifest", {
    expectedNonce: manifest.encryption.manifest.nonce,
  });

  const expectedAssetSha256 = claims.assetSha256 ?? manifest.assetSha256;
  if (expectedAssetSha256 && assetStats.sha256 !== expectedAssetSha256) {
    throw new AuthError("Uploaded asset bytes do not match the PrimeGate publish attestation.", 400);
  }

  if (assetStats.plaintextSize !== claims.sizeBytes) {
    throw new AuthError("Uploaded asset size does not match the PrimeGate publish attestation.", 400);
  }

  return savePublishedAsset({
    assetBlobName: claims.assetBlobName,
    assetSha256: assetStats.sha256,
    ciphertextSizeBytes: assetStats.ciphertextSize,
    contentKeyEnvelope: wrapPrimeGateContentKey(contentKey),
    createdAt: claims.createdAt,
    description: claims.description,
    keywords: claims.keywords,
    license: claims.license,
    id: claims.id,
    manifestBlobName: claims.manifestBlobName,
    encryptionJson: JSON.stringify(manifest.encryption),
    manifestCiphertextSizeBytes: manifestStats.ciphertextSize,
    mimeType: claims.mimeType,
    originalFileName: claims.originalFileName,
    ownerAddress: claims.ownerAddress,
    packageSlug: claims.packageSlug,
    priceApt: claims.priceApt,
    readmeMarkdown: claims.readmeMarkdown,
    releaseChannel: claims.releaseChannel,
    releaseNotes: claims.releaseNotes,
    releaseVersion: claims.releaseVersion,
    sizeBytes: claims.sizeBytes,
    title: claims.title,
  });
}
