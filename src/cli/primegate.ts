#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { createHash } from "node:crypto";

import { PrimeGateClientError, createPrimeGateClient } from "../lib/primegate-client";
import { formatPrimeGatePackageTypeLabel } from "../lib/primegate-package-type";
import { normalizeAptAmount, parseAptAmountToOctas } from "../lib/aptos-amount";
import { getPrimeGateTransactionOptions } from "../lib/aptos-gas";
import { readPrimeGateEnvValue } from "../lib/primegate-env";
import { normalizePrimeGatePackageSlug, normalizePrimeGateReleaseVersion } from "../lib/primegate-package";
import {
  createPrimeGateContentKey,
  createPrimeGateContentNonce,
  createPrimeGateEncryptedBytesStream,
  encodePrimeGateBase64Url,
  PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM,
  PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
  PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_VERSION,
} from "../lib/primegate-content-encryption";
import {
  PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS,
  encodePrimeGatePackageId,
  getPrimeGateRegistryFunctionId,
} from "../lib/primegate-registry-contract";
import {
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
} from "@aptos-labs/ts-sdk";
import {
  createBlobKey,
  createDefaultErasureCodingProvider,
  expectedTotalChunksets,
  generateCommitments,
  requiredAckCount,
  SHELBY_DEPLOYER,
  ShelbyBlobClient,
  ShelbyNodeClient,
} from "@shelby-protocol/sdk/node";
import {
  PRIMEGATE_APTOS_NETWORK,
  PRIMEGATE_SHELBY_APTOS_NETWORK,
  PRIMEGATE_DEFAULT_SHELBY_APTOS_FULLNODE_URL,
  PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL,
} from "../config/primegate-network";

type CliOptions = {
  baseUrl?: string;
  continueOnError?: boolean;
  dryRun?: boolean;
  json?: boolean;
  manifest?: string;
  output?: string;
  resume?: string;
  token?: string;
  wallet?: string;
  walletsDir?: string;
  walletPattern?: string;
  save?: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function printHelp() {
  console.log(`PrimeGate CLI

Usage:
  pnpm primegate search <query> [--base-url <url>] [--json]
  pnpm primegate resolve <package-id> [--base-url <url>] [--json] [--token <token>]
  pnpm primegate install <package-id> [--base-url <url>] [--output <dir>] [--json] [--token <token>]
  pnpm primegate verify <package-id> [--base-url <url>] [--json] [--token <token>]
  pnpm primegate publish --manifest <path> [--base-url <url>] [--wallet <path>] [--wallets-dir <dir>] [--wallet-pattern <regex>] [--save <path>] [--resume <path>] [--continue-on-error] [--dry-run]

Defaults:
  --base-url ${DEFAULT_BASE_URL}
  --token PRIMEGATE_SESSION_TOKEN
`);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry) {
      continue;
    }

    if (!entry.startsWith("--")) {
      positional.push(entry);
      continue;
    }

    if (entry === "--json") {
      options.json = true;
      continue;
    }

    if (entry === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (entry === "--continue-on-error") {
      options.continueOnError = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${entry}.`);
    }

    if (entry === "--base-url") {
      options.baseUrl = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--output") {
      options.output = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--manifest") {
      options.manifest = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--wallet") {
      options.wallet = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--wallets-dir") {
      options.walletsDir = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--wallet-pattern") {
      options.walletPattern = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--save") {
      options.save = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--resume") {
      options.resume = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--token") {
      options.token = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${entry}`);
  }

  return { options, positional };
}

function getClient(options: CliOptions) {
  return createPrimeGateClient({
    baseUrl: options.baseUrl ?? process.env.PRIMEGATE_BASE_URL ?? DEFAULT_BASE_URL,
    getAuthToken: () => options.token ?? process.env.PRIMEGATE_SESSION_TOKEN,
  });
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPackageIdentity(packageId: string, packageName: string, packageHandle?: string | null) {
  return packageHandle ? `${packageName} [${packageHandle}]` : `${packageName} [${packageId}]`;
}

async function readPrimeGateStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }

    chunks.push(next.value);
    size += next.value.byteLength;
  }

  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

type PublishManifestItem = {
  description: string;
  filePath: string;
  keywords?: string[];
  license?: string;
  packageSlug: string;
  priceApt: string;
  readmeMarkdown?: string;
  releaseChannel?: string;
  releaseNotes?: string;
  releaseVersion: string;
  title: string;
};

type PublishManifest = {
  items: PublishManifestItem[];
};

type PublishIntentResponse = {
  assetBlobName: string;
  attestationToken: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  manifestBlobName: string;
  ownerAddress: string;
  storageAccount: string;
};

type PrimeGateShelbySponsorConfig = {
  enabled: boolean;
  serviceHealthy: boolean;
  sponsorAddress: string | null;
  status: "active" | "unavailable" | "not-configured";
};

type PrimeGateSponsorSubmission = { hash: string };

type PublishedAssetRecord = {
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
  listingStatus?: "active" | "failed" | "pending";
  listingError?: string | null;
  sizeBytes: number;
  title: string;
  version: string;
};

type PrimeGateSession = {
  session: {
    expiresAt: string;
    keyType: string;
    publicKeyHex: string;
    token: string;
    walletAddress: string;
  };
};

type WalletMessageChallenge = {
  application: string;
  chainId: number;
  message: string;
  nonce: string;
  walletAddress: string;
};

const DEFAULT_WALLET_PATH = path.join(".local", "primegate-contract-wallet.json");

async function loadDotEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  try {
    return await readFile(envPath, "utf8");
  } catch {
    return null;
  }
}

async function loadDotEnv() {
  const raw = await loadDotEnvFile();
  if (!raw) {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (value.startsWith("\"") && value.endsWith("\"")) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function sha256Hex(bytes: Uint8Array) {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return `0x${digest}`;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".md":
    case ".markdown":
    case ".mdx":
      return "text/markdown";
    case ".prompt":
    case ".txt":
      return "text/plain";
    case ".csv":
      return "text/csv";
    case ".json":
    case ".jsonl":
      return "application/json";
    case ".yaml":
    case ".yml":
      return "text/yaml";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".gz":
    case ".tgz":
      return "application/gzip";
    default:
      return "application/octet-stream";
  }
}

async function requestJson<T>(baseUrl: string, path: string, init?: RequestInit, token?: string) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  });

  const payload = (await response.json().catch(() => null)) as { data?: T; error?: string } | null;
  if (!response.ok) {
    throw new Error(payload?.error ?? `Request failed with status ${response.status}.`);
  }

  if (!payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error("API response was malformed.");
  }

  return payload.data as T;
}

function assertSponsorServiceAvailable(config: PrimeGateShelbySponsorConfig) {
  if (config.status !== "active" || !config.enabled || !config.sponsorAddress) {
    throw new Error("The PrimeGate sponsor service is not ready for autonomous publishing.");
  }
}

async function submitSponsorOperation(
  baseUrl: string,
  token: string,
  payload: Record<string, unknown>,
) {
  return requestJson<PrimeGateSponsorSubmission>(
    baseUrl,
    "/api/shelby-sponsor/submit",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

async function withShelbyRequestOrigin<T>(origin: string, operation: () => Promise<T>) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith("https://api.shelbynet.shelby.xyz/")) {
      return originalFetch(input, init);
    }

    const headers = new Headers(init?.headers);
    headers.set("Origin", origin);
    return originalFetch(input, { ...init, headers });
  };

  try {
    return await operation();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function createPrimeGateSessionToken(baseUrl: string, account: Ed25519Account) {
  const walletAddress = account.accountAddress.toStringLong().toLowerCase();
  const nonceResponse = await fetch(`${baseUrl}/api/auth/message/nonce`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress }),
  });

  const noncePayload = (await nonceResponse.json().catch(() => null)) as
    | { data?: WalletMessageChallenge; error?: string }
    | null;
  if (!nonceResponse.ok || !noncePayload?.data) {
    throw new Error(noncePayload?.error ?? "Unable to request wallet message challenge.");
  }

  const rawCookie = nonceResponse.headers.get("set-cookie");
  if (!rawCookie) {
    throw new Error("PrimeGate message-sign challenge was not found.");
  }

  const cookieHeader = rawCookie.split(";")[0] ?? "";
  if (!cookieHeader) {
    throw new Error("PrimeGate message-sign challenge cookie was invalid.");
  }

  const challenge = noncePayload.data;

  const fullMessage = [
    "APTOS",
    `address: ${walletAddress}`,
    `chain_id: ${challenge.chainId}`,
    `application: ${challenge.application}`,
    `nonce: ${challenge.nonce}`,
    `message: ${challenge.message}`,
  ].join("\n");

  const signature = account.sign(new TextEncoder().encode(fullMessage)).toString();
  const publicKey = account.publicKey.toString();

  const session = await requestJson<PrimeGateSession>(
    baseUrl,
    "/api/auth/message/verify",
    {
      method: "POST",
      headers: {
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        address: walletAddress,
        application: challenge.application,
        chainId: challenge.chainId,
        fullMessage,
        message: challenge.message,
        nonce: challenge.nonce,
        prefix: "APTOS",
        publicKey,
        signature,
        walletAddress,
      }),
    },
  );

  return session.session.token;
}

async function loadOrCreatePublisherAccount(walletPath: string) {
  const resolvedPath = path.resolve(walletPath);
  try {
    const walletRaw = await readFile(resolvedPath, "utf8");
    const wallet = JSON.parse(walletRaw) as { privateKey?: string };
    if (!wallet.privateKey) {
      throw new Error(`Wallet file is missing the privateKey: ${resolvedPath}`);
    }

    return new Ed25519Account({
      privateKey: new Ed25519PrivateKey(wallet.privateKey),
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    const account = Ed25519Account.generate();
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(
      resolvedPath,
      JSON.stringify(
        {
          address: account.accountAddress.toStringLong().toLowerCase(),
          privateKey: account.privateKey.toString(),
        },
        null,
        2,
      ),
      { encoding: "utf8", mode: 0o600 },
    );
    console.error(`Created autonomous publisher wallet at ${resolvedPath}`);
    return account;
  }
}

async function runPublish(options: CliOptions) {
  await loadDotEnv();
  const baseUrl = options.baseUrl ?? process.env.PRIMEGATE_BASE_URL ?? DEFAULT_BASE_URL;
  const manifestPath = options.manifest ?? "artifacts/manifest.json";
  const walletsDir = options.walletsDir ?? process.env.PRIMEGATE_PUBLISH_WALLETS_DIR ?? ".local";
  const walletPattern = options.walletPattern ?? process.env.PRIMEGATE_PUBLISH_WALLET_PATTERN ?? "^primegate-publisher-wallet-.*\\.json$";
  const shelbyApiKey = readPrimeGateEnvValue(process.env.VITE_SHELBY_API_KEY);
  const shelbyRpcBaseUrl =
    readPrimeGateEnvValue(process.env.VITE_SHELBY_RPC_BASE_URL) || PRIMEGATE_DEFAULT_SHELBY_RPC_BASE_URL;
  const registryAddress =
    readPrimeGateEnvValue(process.env.VITE_PRIMEGATE_REGISTRY_ADDRESS) ||
    PRIMEGATE_DEPLOYED_REGISTRY_ADDRESS;

  if (!shelbyApiKey) {
    throw new Error("Missing VITE_SHELBY_API_KEY for Shelby uploads.");
  }

  const manifestRaw = await readFile(path.resolve(manifestPath), "utf8");
  const manifest = JSON.parse(manifestRaw) as PublishManifest;
  if (!manifest.items?.length) {
    throw new Error("Publish manifest is empty.");
  }

  const aptos = new Aptos(new AptosConfig({ network: PRIMEGATE_APTOS_NETWORK }));
  const shelbyAptos = new Aptos(new AptosConfig({ network: PRIMEGATE_SHELBY_APTOS_NETWORK }));
  const shelbyClient = new ShelbyNodeClient({
    apiKey: shelbyApiKey,
    network: PRIMEGATE_SHELBY_APTOS_NETWORK,
    rpc: {
      baseUrl: shelbyRpcBaseUrl,
    },
  });

  let walletFiles: string[] = [];

  if (options.wallet) {
    walletFiles = [options.wallet];
  } else {
    const resolvedWalletsDir = path.resolve(walletsDir);
    const files = await readdir(resolvedWalletsDir).catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        return [];
      }
      throw error;
    });
    const pattern = new RegExp(walletPattern);
    walletFiles = files.filter((file) => pattern.test(file)).map((file) => path.join(resolvedWalletsDir, file));
  }

  if (walletFiles.length === 0) {
    walletFiles = [path.resolve(DEFAULT_WALLET_PATH)];
  }

  const walletCache = new Map<string, { account: Ed25519Account; token: string }>();
  const published: PublishedAssetRecord[] = [];
  const skipped = new Set<string>();

  if (options.resume) {
    try {
      const resumeRaw = await readFile(path.resolve(options.resume), "utf8");
      const resumePayload = JSON.parse(resumeRaw) as { published?: PublishedAssetRecord[] };
      for (const entry of resumePayload.published ?? []) {
        if (entry.packageSlug) {
          skipped.add(entry.packageSlug);
        }
      }
    } catch {
      // Ignore resume if unreadable.
    }
  }

  for (let index = 0; index < manifest.items.length; index += 1) {
    const item = manifest.items[index];
    const normalizedSlug = normalizePrimeGatePackageSlug(item.packageSlug);
    if (skipped.has(normalizedSlug)) {
      continue;
    }
    const walletPath = walletFiles[index % walletFiles.length];
    let walletEntry = walletCache.get(walletPath);
    if (!walletEntry) {
      const account = await loadOrCreatePublisherAccount(walletPath);
      const token = await createPrimeGateSessionToken(baseUrl, account);
      walletEntry = { account, token };
      walletCache.set(walletPath, walletEntry);
    }

    const account = walletEntry.account;
    const token = walletEntry.token;
    const absolutePath = path.resolve(item.filePath);
    const fileBytes = new Uint8Array(await readFile(absolutePath));
    const assetSha256 = sha256Hex(fileBytes);
    const normalizedPrice = normalizeAptAmount(item.priceApt);
    const normalizedVersion = normalizePrimeGateReleaseVersion(item.releaseVersion);
    const keywords = item.keywords ?? [];
    const license = item.license?.trim() || "Custom";
    const readmeMarkdown = item.readmeMarkdown ?? "";
    const releaseChannel = item.releaseChannel?.trim() || "latest";
    const releaseNotes = item.releaseNotes ?? "";
    const mimeType = getMimeType(absolutePath);
    const originalFileName = path.basename(absolutePath);

    if (options.dryRun) {
      console.log(`[dry-run] ${item.title} (${originalFileName}) via ${account.accountAddress.toStringLong()}`);
      continue;
    }

    try {
      const publishIntent = await requestJson<PublishIntentResponse>(
        baseUrl,
        "/api/publish-intent",
        {
          method: "POST",
          body: JSON.stringify({
            assetSha256,
            description: item.description,
            keywords,
            license,
            mimeType,
            originalFileName,
            packageSlug: normalizedSlug,
            priceApt: normalizedPrice,
            readmeMarkdown,
            releaseChannel,
            releaseNotes,
            releaseVersion: normalizedVersion,
            sizeBytes: fileBytes.byteLength,
            title: item.title,
          }),
        },
        token,
      );

      const contentKey = createPrimeGateContentKey();
      const encryptedAsset = await createPrimeGateEncryptedBytesStream(
        fileBytes,
        "asset",
        contentKey,
      );
      const encryptedAssetBytes = await readPrimeGateStream(encryptedAsset.stream);
      const manifestNonce = createPrimeGateContentNonce();

      const manifestPayload = {
        assetBlobName: publishIntent.assetBlobName,
        assetSha256,
        createdAt: publishIntent.createdAt,
        description: item.description,
        encryption: {
          algorithm: PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM,
          asset: { nonce: encryptedAsset.nonce },
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
        originalFileName,
        ownerAddress: account.accountAddress.toStringLong().toLowerCase(),
        storageAccount: publishIntent.storageAccount,
        packageSlug: normalizedSlug,
        priceApt: normalizedPrice,
        publishAttestation: publishIntent.attestationToken,
        publishIntentId: publishIntent.id,
        readmeMarkdown,
        releaseChannel,
        releaseNotes,
        releaseVersion: normalizedVersion,
        sizeBytes: fileBytes.byteLength,
        source: "primegate",
        title: item.title,
        version: 1,
      } as const;

      const manifestBytes = new TextEncoder().encode(JSON.stringify(manifestPayload, null, 2));
      const encryptedManifest = await createPrimeGateEncryptedBytesStream(
        manifestBytes,
        "manifest",
        contentKey,
        { nonce: manifestNonce },
      );
      const encryptedManifestBytes = await readPrimeGateStream(encryptedManifest.stream);

      if (encryptedAssetBytes.byteLength !== encryptedAsset.ciphertextSize) {
        throw new Error("PrimeGate encrypted asset size did not match the generated ciphertext.");
      }

      if (encryptedManifestBytes.byteLength !== encryptedManifest.ciphertextSize) {
        throw new Error("PrimeGate encrypted manifest size did not match the generated ciphertext.");
      }

      const provider = await createDefaultErasureCodingProvider();
      const [assetCommitments, manifestCommitments] = await Promise.all([
        generateCommitments(provider, encryptedAssetBytes),
        generateCommitments(provider, encryptedManifestBytes),
      ]);
      const sponsorConfig = await requestJson<PrimeGateShelbySponsorConfig>(
        baseUrl,
        "/api/shelby-sponsor/config",
        undefined,
        token,
      );
      assertSponsorServiceAvailable(sponsorConfig);
      const expirationMicros = (Date.now() + 365 * 24 * 60 * 60 * 1000) * 1000;
      const registration = await submitSponsorOperation(baseUrl, token, {
        attestationToken: publishIntent.attestationToken,
        blobs: [
          {
            blobMerkleRoot: assetCommitments.blob_merkle_root,
            blobName: publishIntent.assetBlobName,
            blobSize: assetCommitments.raw_data_size,
            numChunksets: expectedTotalChunksets(
              assetCommitments.raw_data_size,
              provider.config.chunkSizeBytes * provider.config.erasure_k,
            ),
          },
          {
            blobMerkleRoot: manifestCommitments.blob_merkle_root,
            blobName: publishIntent.manifestBlobName,
            blobSize: manifestCommitments.raw_data_size,
            numChunksets: expectedTotalChunksets(
              manifestCommitments.raw_data_size,
              provider.config.chunkSizeBytes * provider.config.erasure_k,
            ),
          },
        ],
        encoding: provider.config.enumIndex,
        expirationMicros,
        operation: "shelby-registration-v2",
        walletAddress: account.accountAddress.toStringLong(),
      });
      const confirmedRegistration = await shelbyAptos.waitForTransaction({
        transactionHash: registration.hash,
      });
      const uidByObjectName = new Map(
        ShelbyBlobClient.registeredBlobUids(
          "events" in confirmedRegistration ? confirmedRegistration.events : [],
          AccountAddress.from(SHELBY_DEPLOYER),
        ).map((registered) => [registered.objectName, registered.uid]),
      );
      const assetUid = uidByObjectName.get(
        createBlobKey({
          account: publishIntent.storageAccount,
          blobName: publishIntent.assetBlobName,
        }),
      );
      const manifestUid = uidByObjectName.get(
        createBlobKey({
          account: publishIntent.storageAccount,
          blobName: publishIntent.manifestBlobName,
        }),
      );

      if (assetUid === undefined || manifestUid === undefined) {
        throw new Error("Shelby did not return both registered blob identifiers.");
      }

      const uploadOrigin = new URL(baseUrl).origin;
      const [assetUpload, manifestUpload] = await withShelbyRequestOrigin(uploadOrigin, () =>
        Promise.all([
          shelbyClient.rpc.putBlobChunksets({
            accountAddress: publishIntent.storageAccount,
            blobData: encryptedAssetBytes,
            commitments: assetCommitments,
            totalBytes: encryptedAssetBytes.byteLength,
            uid: assetUid,
          }),
          shelbyClient.rpc.putBlobChunksets({
            accountAddress: publishIntent.storageAccount,
            blobData: encryptedManifestBytes,
            commitments: manifestCommitments,
            totalBytes: encryptedManifestBytes.byteLength,
            uid: manifestUid,
          }),
        ]),
      );
      const minimumAcks = requiredAckCount(provider.config.erasure_n);
      if (assetUpload.spAcks.length < minimumAcks || manifestUpload.spAcks.length < minimumAcks) {
        throw new Error("Shelby did not return enough storage provider acknowledgements.");
      }

      for (const commit of [
        { blobName: publishIntent.assetBlobName, spAcks: assetUpload.spAcks, uid: assetUid },
        { blobName: publishIntent.manifestBlobName, spAcks: manifestUpload.spAcks, uid: manifestUid },
      ]) {
        const pendingCommit = await submitSponsorOperation(baseUrl, token, {
          attestationToken: publishIntent.attestationToken,
          blobName: commit.blobName,
          operation: "shelby-commit-v2",
          storageProviderAcks: commit.spAcks.map((ack) => ({
            signature: `0x${Buffer.from(ack.signature).toString("hex")}`,
            slot: ack.slot,
          })),
          uid: commit.uid.toString(),
          walletAddress: account.accountAddress.toStringLong(),
        });
        await shelbyAptos.waitForTransaction({ transactionHash: pendingCommit.hash });
      }

      const finalized = await requestJson<PublishedAssetRecord>(
        baseUrl,
        "/api/published-assets",
        {
          method: "POST",
          body: JSON.stringify({
            assetEncryptionKey: encodePrimeGateBase64Url(contentKey),
            attestationToken: publishIntent.attestationToken,
          }),
        },
        token,
      );

      if (normalizedPrice !== "0") {
        const listingOptions = await getPrimeGateTransactionOptions(10_000);
        const listingTransaction = await aptos.transaction.build.simple({
          sender: account.accountAddress,
          withFeePayer: true,
          data: {
            function: getPrimeGateRegistryFunctionId(registryAddress, "upsert_listing"),
            functionArguments: [
              encodePrimeGatePackageId(finalized.id),
              parseAptAmountToOctas(normalizedPrice).toString(),
            ],
          },
          options: listingOptions,
        });
        listingTransaction.feePayerAddress = AccountAddress.from(sponsorConfig.sponsorAddress!);
        const senderAuthenticator = account.signTransactionWithAuthenticator(listingTransaction);
        const pending = await submitSponsorOperation(baseUrl, token, {
          expectedPackageId: finalized.id,
          expectedPriceOctas: parseAptAmountToOctas(normalizedPrice).toString(),
          operation: "primegate-listing",
          senderAuthenticatorHex: senderAuthenticator.bcsToHex().toString(),
          transactionHex: listingTransaction.bcsToHex().toString(),
          walletAddress: account.accountAddress.toStringLong(),
        });
        await aptos.waitForTransaction({ transactionHash: pending.hash });

        const syncedListing = await requestJson<PublishedAssetRecord>(
          baseUrl,
          "/api/published-assets?route=listing-status",
          {
            method: "POST",
            body: JSON.stringify({ packageId: finalized.id }),
          },
          token,
        );

        if (syncedListing.listingStatus !== "active") {
          throw new Error(syncedListing.listingError ?? "The on-chain listing could not be confirmed.");
        }
      }

      published.push(finalized);
      console.log(`Published ${finalized.title} (${finalized.id})`);

      if (options.save) {
        const outputPath = path.resolve(options.save);
        await writeFile(outputPath, JSON.stringify({ published }, null, 2), "utf8");
      }
    } catch (error) {
      console.error(
        error instanceof Error ? `Publish failed for ${item.title}: ${error.message}` : "Publish failed.",
      );
      if (!options.continueOnError) {
        throw error;
      }
    }
  }

  if (options.json) {
    console.log(JSON.stringify(published, null, 2));
  }
}

async function runSearch(query: string, options: CliOptions) {
  const client = getClient(options);
  const results = await client.searchPackages(query);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No PrimeGate packages matched "${query}".`);
    return;
  }

  for (const pkg of results) {
    console.log(pkg.name);
    console.log(`  id: ${pkg.id}`);
    if (pkg.packageHandle) {
      console.log(`  handle: ${pkg.packageHandle}`);
    }
    console.log(`  ${formatPrimeGatePackageTypeLabel(pkg.type)} · ${pkg.price} · ${pkg.publisher}`);
    console.log(`  ${pkg.description}`);
  }
}

async function runResolve(packageId: string, options: CliOptions) {
  const client = getClient(options);
  const resolution = await client.resolvePackage(packageId);

  if (options.json) {
    console.log(JSON.stringify(resolution, null, 2));
    return;
  }

  console.log(
    `${formatPackageIdentity(resolution.packageId, resolution.packageName, resolution.packageHandle)} (${resolution.version})`,
  );
  console.log(`Release ID: ${resolution.packageId}`);
  console.log(`Resolve: ${resolution.resolveUrl}`);
  console.log(`Access: ${resolution.access}`);
  console.log(`Price: ${resolution.price}`);
  if (resolution.offer) {
    console.log(`Offer: ${resolution.offer.name} (${resolution.offer.slug})`);
    console.log(`License: ${resolution.offer.license}`);
  }

  if (resolution.artifact) {
    console.log(
      `Artifact: ${resolution.artifact.originalFileName} (${formatBytes(resolution.artifact.sizeBytes)})`,
    );
    console.log(`Manifest: ${resolution.manifestUrl}`);
    console.log(`Download: ${resolution.downloadUrl}`);
  } else {
    console.log("Artifact: not exposed yet for this caller.");
  }

  console.log(`CLI: ${resolution.install.cli}`);
  console.log(`SDK: ${resolution.install.sdk}`);
  console.log(`MCP: ${resolution.install.mcp}`);
}

async function runInstall(packageId: string, options: CliOptions) {
  const client = getClient(options);
  const resolution = await client.resolvePackage(packageId);

  if (!resolution.downloadUrl || !resolution.artifact) {
    throw new Error(
      resolution.access === "purchase-required"
        ? "This package requires entitlement before PrimeGate will expose the artifact."
        : "This package does not expose a downloadable artifact.",
    );
  }

  const outputRoot = path.resolve(options.output ?? path.join(process.cwd(), "primegate-downloads"));
  const packageOutputDir = path.join(outputRoot, packageId);
  await mkdir(packageOutputDir, { recursive: true });

  const artifact = await client.downloadArtifact(packageId);
  const artifactFileName = artifact.fileName ?? resolution.artifact.originalFileName;
  const artifactPath = path.join(packageOutputDir, artifactFileName);
  await writeFile(artifactPath, Buffer.from(artifact.arrayBuffer));

  const manifest = await client.getPackageManifest(packageId);
  const manifestPath = path.join(packageOutputDir, "primegate-manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const result = {
    access: resolution.access,
    artifactPath,
    downloadUrl: resolution.downloadUrl,
    manifestPath,
    manifestUrl: resolution.manifestUrl,
    packageHandle: resolution.packageHandle ?? null,
    packageId: resolution.packageId,
    packageName: resolution.packageName,
    resolveUrl: resolution.resolveUrl,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    `Installed ${formatPackageIdentity(resolution.packageId, resolution.packageName, resolution.packageHandle)}`,
  );
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Resolve: ${resolution.resolveUrl}`);
  if (artifactFileName.toLowerCase().endsWith(".zip")) {
    console.log("Archive: packaged bundle downloaded. Extract it locally to use the full contents.");
  }
}

async function runVerify(packageId: string, options: CliOptions) {
  const client = getClient(options);
  const resolution = await client.resolvePackage(packageId);

  if (!resolution.artifact || !resolution.downloadUrl || !resolution.artifact.assetSha256) {
    throw new Error("PrimeGate did not expose an artifact hash for this caller.");
  }

  const artifact = await client.downloadArtifact(packageId);
  const actualHash = `0x${createHash("sha256").update(Buffer.from(artifact.arrayBuffer)).digest("hex")}`;
  const expectedHash = resolution.artifact.assetSha256.toLowerCase();
  const result = {
    artifact: resolution.artifact.originalFileName,
    expectedSha256: expectedHash,
    packageId: resolution.packageId,
    packageHandle: resolution.packageHandle ?? null,
    verified: actualHash === expectedHash,
    actualSha256: actualHash,
    version: resolution.version,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`Package: ${formatPackageIdentity(resolution.packageId, resolution.packageName, resolution.packageHandle)}`);
    console.log(`Version: ${resolution.version}`);
    console.log(`Artifact: ${resolution.artifact.originalFileName}`);
    console.log(`Expected SHA-256: ${expectedHash}`);
    console.log(`Downloaded SHA-256: ${actualHash}`);
    console.log(`Integrity: ${result.verified ? "verified" : "mismatch"}`);
  }

  if (!result.verified) {
    throw new Error("Downloaded artifact hash does not match the PrimeGate release manifest.");
  }
}

async function main() {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const [command, ...rest] = positional;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "search") {
    if (rest.length === 0) {
      throw new Error("search requires a query.");
    }

    await runSearch(rest.join(" "), options);
    return;
  }

  if (command === "resolve") {
    const packageId = rest[0];
    if (!packageId) {
      throw new Error("resolve requires a package id.");
    }

    await runResolve(packageId, options);
    return;
  }

  if (command === "install") {
    const packageId = rest[0];
    if (!packageId) {
      throw new Error("install requires a package id.");
    }

    await runInstall(packageId, options);
    return;
  }

  if (command === "verify") {
    const packageId = rest[0];
    if (!packageId) {
      throw new Error("verify requires a package id.");
    }

    await runVerify(packageId, options);
    return;
  }

  if (command === "publish") {
    if (!options.manifest) {
      throw new Error("publish requires --manifest <path>.");
    }

    await runPublish(options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  if (error instanceof PrimeGateClientError) {
    console.error(`PrimeGate API error (${error.status}) on ${error.path}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    if (process.env.PRIMEGATE_DEBUG) {
      console.error(error.stack ?? error.message);
    } else {
      console.error(error.message);
    }
    process.exitCode = 1;
    return;
  }

  console.error("PrimeGate CLI failed.");
  process.exitCode = 1;
});
