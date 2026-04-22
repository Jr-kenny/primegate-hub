import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { AccountAddress } from "@aptos-labs/ts-sdk";

import { AuthError } from "./auth.js";
import { savePublishedAsset } from "./catalog.js";
import { getShelbyClient } from "./shelby.js";
import { normalizeAptAmount } from "../../src/lib/aptos-amount.js";
import {
  normalizePrimeGatePackageSlug,
  normalizePrimeGateReleaseVersion,
} from "../../src/lib/primegate-package.js";

const PRIMEGATE_PUBLISH_SOURCE = "primegate";
const PRIMEGATE_PUBLISH_VERSION = 1;
const PRIMEGATE_PUBLISH_INTENT_TTL_MS = 1000 * 60 * 10;

const createPublishIntentSchema = z.object({
  assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/),
  description: z.string().min(1),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  title: z.string().min(1),
});

const finalizePublishedAssetSchema = z.object({
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
  assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/),
  createdAt: z.string().datetime(),
  description: z.string().min(1),
  manifestBlobName: z.string().min(1),
  mimeType: z.string().min(1),
  originalFileName: z.string().min(1),
  ownerAddress: z.string().min(1),
  packageSlug: z.string().min(1),
  priceApt: z.string().min(1),
  publishAttestation: z.string().min(1),
  publishIntentId: z.string().uuid(),
  releaseVersion: z.string().min(1),
  sizeBytes: z.number().int().min(0),
  source: z.literal(PRIMEGATE_PUBLISH_SOURCE),
  title: z.string().min(1),
  version: z.literal(PRIMEGATE_PUBLISH_VERSION),
});

const legacyPublishedManifestSchema = z
  .object({
    assetBlobName: z.string().min(1),
    assetSha256: z.string().regex(/^0x[a-f0-9]{64}$/),
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
  "packageSlug" | "releaseVersion"
> & {
  packageSlug: string | null;
  price?: number | string;
  releaseVersion: string | null;
};

function getPublishSecret() {
  const secret =
    process.env.PRIMEGATE_PUBLISH_SECRET?.trim() || process.env.PRIMEGATE_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("PRIMEGATE_SESSION_SECRET is not configured.");
  }

  return secret;
}

function normalizeWalletAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function getFileExtension(fileName: string) {
  const segments = fileName.split(".");
  return segments.length > 1 ? segments.at(-1)?.toLowerCase() ?? "bin" : "bin";
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
): Promise<PrimeGatePublishedManifest> {
  const manifestBytes = await readShelbyBlobBytes(ownerAddress, manifestBlobName);
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

export async function readPublishedAssetBytes(ownerAddress: string, assetBlobName: string) {
  return readShelbyBlobBytes(ownerAddress, assetBlobName);
}

function sha256Hex(value: Uint8Array) {
  return `0x${createHash("sha256").update(value).digest("hex")}`;
}

function assertIntentMatchesManifest(
  claims: z.infer<typeof publishIntentClaimsSchema>,
  manifest: PrimeGatePublishedManifest,
) {
  if (!manifest.packageSlug) {
    throw new AuthError("Published manifest package slug is missing.", 400);
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

  if (manifest.assetSha256 !== claims.assetSha256) {
    throw new AuthError("Published manifest asset hash does not match the PrimeGate intent.", 400);
  }

  if (manifest.title !== claims.title) {
    throw new AuthError("Published manifest title does not match the PrimeGate intent.", 400);
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
  const parsed = {
    ...parsedInput,
    packageSlug: normalizePrimeGatePackageSlug(parsedInput.packageSlug),
    priceApt: normalizeAptAmount(parsedInput.priceApt),
    releaseVersion: normalizePrimeGateReleaseVersion(parsedInput.releaseVersion),
  };
  const normalizedOwnerAddress = normalizeWalletAddress(ownerAddress);
  const issuedAt = Date.now();
  const id = randomUUID();
  const createdAt = new Date(issuedAt).toISOString();
  const expiresAt = issuedAt + PRIMEGATE_PUBLISH_INTENT_TTL_MS;

  const claims = publishIntentClaimsSchema.parse({
    ...parsed,
    assetBlobName: `primegate/packages/${parsed.packageSlug}/${parsed.releaseVersion}/${id}.${getFileExtension(parsed.originalFileName)}`,
    createdAt,
    exp: expiresAt,
    iat: issuedAt,
    id,
    manifestBlobName: `primegate/manifests/${parsed.packageSlug}/${parsed.releaseVersion}/${id}.json`,
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
  const { attestationToken } = finalizePublishedAssetSchema.parse(input);
  const claims = verifyPublishAttestationToken(attestationToken);
  const normalizedOwnerAddress = normalizeWalletAddress(ownerAddress);

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

  const manifest = await readPublishedManifest(claims.ownerAddress, claims.manifestBlobName);

  assertIntentMatchesManifest(claims, manifest);

  const assetBytes = await readPublishedAssetBytes(claims.ownerAddress, claims.assetBlobName);
  const assetSha256 = sha256Hex(assetBytes);

  if (assetSha256 !== claims.assetSha256) {
    throw new AuthError("Uploaded asset bytes do not match the PrimeGate publish attestation.", 400);
  }

  if (assetBytes.byteLength !== claims.sizeBytes) {
    throw new AuthError("Uploaded asset size does not match the PrimeGate publish attestation.", 400);
  }

  return savePublishedAsset({
    assetBlobName: claims.assetBlobName,
    createdAt: claims.createdAt,
    description: claims.description,
    id: claims.id,
    manifestBlobName: claims.manifestBlobName,
    mimeType: claims.mimeType,
    originalFileName: claims.originalFileName,
    ownerAddress: claims.ownerAddress,
    packageSlug: claims.packageSlug,
    priceApt: claims.priceApt,
    releaseVersion: claims.releaseVersion,
    sizeBytes: claims.sizeBytes,
    title: claims.title,
  });
}
