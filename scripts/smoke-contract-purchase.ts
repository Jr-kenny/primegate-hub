import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node";

import { normalizeAptAmount, parseAptAmountToOctas } from "../src/lib/aptos-amount";
import { normalizePrimeGatePackageSlug } from "../src/lib/primegate-package";
import {
  encodePrimeGatePackageId,
  getPrimeGateRegistryFunctionId,
} from "../src/lib/primegate-registry-contract";

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envFile = fs.readFileSync(envPath, "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!key || process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = value;
  }
}

loadDotEnv();

type WalletFile = {
  address: string;
  privateKey: string;
};

type ApiEnvelope<T> = {
  data: T;
};

type MessageChallenge = {
  application: string;
  chainId: number;
  message: string;
  nonce: string;
  walletAddress: string;
};

type SessionResponse = {
  session: {
    token: string;
    walletAddress: string;
  };
};

type PublishIntentResponse = {
  assetBlobName: string;
  attestationToken: string;
  createdAt: string;
  id: string;
  manifestBlobName: string;
  ownerAddress: string;
};

type PublishedAssetRecord = {
  assetBlobName: string;
  createdAt: string;
  id: string;
  manifestBlobName: string;
  mimeType: string;
  originalFileName: string;
  ownerAddress: string;
  price: number;
  sizeBytes: number;
  title: string;
};

type RegistryPackageResolution = {
  artifact: {
    downloadUrl: string | null;
    manifestUrl: string | null;
  } | null;
  payment: {
    amountApt: string;
    amountOctas: string;
    currency: "APT";
    network: "testnet";
    recipientAddress: string;
  } | null;
};

type SmokeResult = {
  buyerAddress: string;
  downloadBytes: number;
  packageId: string;
  priceApt: string;
  purchaseTxHash: string;
  sellerAddress: string;
  title: string;
};

const API_BASE_URL = process.env.PRIMEGATE_API_BASE_URL?.trim() || "http://127.0.0.1:3000";
const SHELBY_API_KEY = process.env.VITE_SHELBY_API_KEY?.trim();
const SHELBY_RPC_BASE_URL =
  process.env.VITE_SHELBY_RPC_BASE_URL?.trim() || "https://api.testnet.shelby.xyz/shelby";
const REGISTRY_ADDRESS =
  process.env.PRIMEGATE_REGISTRY_ADDRESS?.trim() ||
  process.env.VITE_PRIMEGATE_REGISTRY_ADDRESS?.trim() ||
  "0x58e10066c287737386e57de3f6fa1353d811139c36b5e7c8acaa6dd7aebbcbe6";

const SELLER_WALLET_PATH =
  process.env.PRIMEGATE_SELLER_WALLET_PATH?.trim() ||
  path.resolve(".local/aptos-test-wallet-1775628236475.json");
const BUYER_WALLET_PATH =
  process.env.PRIMEGATE_BUYER_WALLET_PATH?.trim() ||
  path.resolve(".local/208d3c98-buyer-wallet.json");
const FUNDING_WALLET_PATH =
  process.env.PRIMEGATE_FUNDING_WALLET_PATH?.trim() ||
  path.resolve(".local/primegate-contract-wallet.json");

const PRICE_APT = normalizeAptAmount(process.env.PRIMEGATE_SMOKE_PRICE_APT?.trim() || "0.0001");
const MIN_FUNDING_RESERVE_OCTAS = 2_000_000n;
const TARGET_SELLER_APT_OCTAS = 20_000_000n;
const BLOB_TTL_MICROS = (Date.now() + 30 * 24 * 60 * 60 * 1000) * 1000;
const STANDARD_MAX_GAS_AMOUNT = 10_000;
const SHELBY_MAX_GAS_AMOUNT = 50_000;

const aptos = new Aptos(
  new AptosConfig({
    network: Network.TESTNET,
  }),
);

const shelbyClient = new ShelbyNodeClient({
  apiKey: SHELBY_API_KEY,
  network: Network.TESTNET,
  rpc: {
    baseUrl: SHELBY_RPC_BASE_URL,
  },
});

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(
    JSON.stringify(
      {
        details: details ?? null,
        step,
      },
      null,
      2,
    ),
  );
}

async function getTransactionOptions(maxGasAmount: number) {
  try {
    const gasEstimate = await aptos.getGasPriceEstimation();
    const gasUnitPrice = Math.ceil(
      Number(
        gasEstimate.gas_estimate ??
          gasEstimate.prioritized_gas_estimate ??
          gasEstimate.deprioritized_gas_estimate ??
          100,
      ),
    );

    return {
      gasUnitPrice: Number.isFinite(gasUnitPrice) && gasUnitPrice > 0 ? gasUnitPrice : 100,
      maxGasAmount,
    };
  } catch {
    return {
      gasUnitPrice: 100,
      maxGasAmount,
    };
  }
}

function normalizePrivateKey(value: string) {
  return value.startsWith("ed25519-priv-") ? value : `ed25519-priv-${value}`;
}

function readWallet(walletPath: string) {
  const raw = fs.readFileSync(walletPath, "utf8");
  const wallet = JSON.parse(raw) as WalletFile;
  const privateKey = new Ed25519PrivateKey(normalizePrivateKey(wallet.privateKey));

  return Account.fromPrivateKeyAndAddress({
    address: AccountAddress.from(wallet.address),
    privateKey,
  });
}

function sha256Hex(bytes: Uint8Array) {
  return `0x${createHash("sha256").update(bytes).digest("hex")}`;
}

function getCookieHeader(response: Response) {
  const headerValue =
    typeof (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie === "function"
      ? (response.headers as Headers & { getSetCookie: () => string[] }).getSetCookie().join("; ")
      : response.headers.get("set-cookie");

  if (!headerValue) {
    throw new Error("Expected Set-Cookie header from PrimeGate auth endpoint.");
  }

  return headerValue
    .split(/,(?=[^;]+?=)/g)
    .map((entry) => entry.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

async function requestJson<T>(
  pathName: string,
  init?: RequestInit,
  options?: {
    cookie?: string;
    token?: string;
  },
) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Origin", API_BASE_URL);

  if (options?.cookie) {
    headers.set("Cookie", options.cookie);
  }

  if (options?.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${pathName}`, {
    ...init,
    headers,
  });
  const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | { error?: string } | null;

  if (!response.ok || !payload || typeof payload !== "object" || !("data" in payload)) {
    throw new Error(
      payload && typeof payload === "object" && "error" in payload && payload.error
        ? payload.error
        : `Request to ${pathName} failed with status ${response.status}.`,
    );
  }

  return {
    data: payload.data,
    response,
  };
}

function buildFullMessage(challenge: MessageChallenge) {
  return [
    "APTOS",
    `address: ${challenge.walletAddress}`,
    `chain_id: ${challenge.chainId}`,
    `application: ${challenge.application}`,
    `nonce: ${challenge.nonce}`,
    `message: ${challenge.message}`,
  ].join("\n");
}

async function createWalletSession(account: Account) {
  logStep("auth:challenge", {
    walletAddress: account.accountAddress.toStringLong(),
  });
  const challengeResponse = await requestJson<MessageChallenge>("/api/auth/message/nonce", {
    body: JSON.stringify({ walletAddress: account.accountAddress.toString() }),
    method: "POST",
  });
  const cookie = getCookieHeader(challengeResponse.response);
  const challenge = challengeResponse.data;
  const fullMessage = buildFullMessage(challenge);
  const signature = account.sign(new TextEncoder().encode(fullMessage)).toString();

  const verifyResponse = await requestJson<SessionResponse>(
    "/api/auth/message/verify",
    {
      body: JSON.stringify({
        address: challenge.walletAddress,
        chainId: challenge.chainId,
        fullMessage,
        message: challenge.message,
        nonce: challenge.nonce,
        prefix: "APTOS",
        publicKey: account.publicKey.toString(),
        signature,
        walletAddress: challenge.walletAddress,
      }),
      method: "POST",
    },
    { cookie },
  );

  logStep("auth:verified", {
    walletAddress: account.accountAddress.toStringLong(),
  });
  return verifyResponse.data.session.token;
}

async function ensureSellerGas(seller: Account, fundingAccount: Account) {
  const sellerBalance = BigInt(
    await aptos.getAccountAPTAmount({ accountAddress: seller.accountAddress }),
  );
  if (sellerBalance >= TARGET_SELLER_APT_OCTAS) {
    logStep("funding:skip", {
      sellerBalance: sellerBalance.toString(),
    });
    return;
  }

  const fundingBalance = BigInt(
    await aptos.getAccountAPTAmount({ accountAddress: fundingAccount.accountAddress }),
  );
  const desiredTopUp = TARGET_SELLER_APT_OCTAS - sellerBalance;
  const availableTopUp = fundingBalance > MIN_FUNDING_RESERVE_OCTAS ? fundingBalance - MIN_FUNDING_RESERVE_OCTAS : 0n;
  const topUpAmount = desiredTopUp < availableTopUp ? desiredTopUp : availableTopUp;

  if (topUpAmount <= 0n) {
    throw new Error("Funding wallet does not have enough APT left to top up the seller for the smoke test.");
  }

  logStep("funding:top-up", {
    fundingBalance: fundingBalance.toString(),
    sellerBalance: sellerBalance.toString(),
    topUpAmount: topUpAmount.toString(),
  });

  const transaction = await aptos.transaction.build.simple({
    sender: fundingAccount.accountAddress,
    data: {
      function: "0x1::aptos_account::transfer",
      functionArguments: [seller.accountAddress, topUpAmount],
    },
    options: await getTransactionOptions(STANDARD_MAX_GAS_AMOUNT),
  });

  const pending = await aptos.signAndSubmitTransaction({
    signer: fundingAccount,
    transaction,
  });

  await aptos.waitForTransaction({ transactionHash: pending.hash });
  logStep("funding:complete", {
    transactionHash: pending.hash,
  });
}

async function publishPaidArtifact(seller: Account, sellerToken: string) {
  const now = new Date().toISOString().replace(/[:.]/g, "-");
  const title = `PrimeGate Contract Smoke ${now}`;
  const description = "Real Shelby-backed paid artifact published through PrimeGate smoke test.";
  const packageSlug = normalizePrimeGatePackageSlug(`primegate-contract-smoke-${now}`);
  const releaseVersion = "1.0.0";
  const fileName = "primegate-contract-smoke.txt";
  const fileBytes = new TextEncoder().encode(
    `primegate contract smoke ${now}\nseller=${seller.accountAddress.toString()}\n`,
  );
  const assetSha256 = sha256Hex(fileBytes);

  const publishIntentResponse = await requestJson<PublishIntentResponse>(
    "/api/publish-intent",
    {
      body: JSON.stringify({
        assetSha256,
        description,
        mimeType: "text/plain",
        originalFileName: fileName,
        packageSlug,
        priceApt: PRICE_APT,
        releaseVersion,
        sizeBytes: fileBytes.byteLength,
        title,
      }),
      method: "POST",
    },
    { token: sellerToken },
  );

  const publishIntent = publishIntentResponse.data;
  logStep("publish:intent", {
    assetBlobName: publishIntent.assetBlobName,
    manifestBlobName: publishIntent.manifestBlobName,
    packageId: publishIntent.id,
  });
  const manifestBytes = new TextEncoder().encode(
    JSON.stringify(
      {
        assetBlobName: publishIntent.assetBlobName,
        assetSha256,
        createdAt: publishIntent.createdAt,
        description,
        manifestBlobName: publishIntent.manifestBlobName,
        mimeType: "text/plain",
        originalFileName: fileName,
        ownerAddress: publishIntent.ownerAddress,
        packageSlug,
        priceApt: PRICE_APT,
        publishAttestation: publishIntent.attestationToken,
        publishIntentId: publishIntent.id,
        releaseVersion,
        sizeBytes: fileBytes.byteLength,
        source: "primegate",
        title,
        version: 1,
      },
      null,
      2,
    ),
  );

  logStep("publish:upload", {
    sellerAddress: seller.accountAddress.toStringLong(),
  });
  await shelbyClient.batchUpload({
    blobs: [
      {
        blobData: fileBytes,
        blobName: publishIntent.assetBlobName,
      },
      {
        blobData: manifestBytes,
        blobName: publishIntent.manifestBlobName,
      },
    ],
    expirationMicros: BLOB_TTL_MICROS,
    options: {
      build: {
        options: await getTransactionOptions(SHELBY_MAX_GAS_AMOUNT),
      },
    },
    signer: seller,
  });
  logStep("publish:uploaded");

  const finalizedResponse = await requestJson<PublishedAssetRecord>(
    "/api/published-assets",
    {
      body: JSON.stringify({
        attestationToken: publishIntent.attestationToken,
      }),
      method: "POST",
    },
    { token: sellerToken },
  );

  const finalized = finalizedResponse.data;
  logStep("publish:finalized", {
    packageId: finalized.id,
  });
  const listingTransaction = await aptos.transaction.build.simple({
    sender: seller.accountAddress,
    data: {
      function: getPrimeGateRegistryFunctionId(REGISTRY_ADDRESS, "upsert_listing"),
      functionArguments: [
        encodePrimeGatePackageId(finalized.id),
        parseAptAmountToOctas(PRICE_APT),
      ],
    },
    options: await getTransactionOptions(STANDARD_MAX_GAS_AMOUNT),
  });
  const pendingListing = await aptos.signAndSubmitTransaction({
    signer: seller,
    transaction: listingTransaction,
  });
  await aptos.waitForTransaction({ transactionHash: pendingListing.hash });
  logStep("publish:listed", {
    packageId: finalized.id,
    transactionHash: pendingListing.hash,
  });

  return {
    packageId: finalized.id,
    title,
  };
}

async function getResolution(packageId: string, token?: string) {
  const result = await requestJson<RegistryPackageResolution>(
    `/api/packages/${encodeURIComponent(packageId)}/resolve`,
    {
      method: "GET",
    },
    token ? { token } : undefined,
  );

  return result.data;
}

async function purchaseArtifact(buyer: Account, buyerToken: string, packageId: string) {
  logStep("purchase:submit", {
    buyerAddress: buyer.accountAddress.toStringLong(),
    packageId,
  });
  const transaction = await aptos.transaction.build.simple({
    sender: buyer.accountAddress,
    data: {
      function: getPrimeGateRegistryFunctionId(REGISTRY_ADDRESS, "purchase_package"),
      functionArguments: [encodePrimeGatePackageId(packageId)],
    },
    options: await getTransactionOptions(STANDARD_MAX_GAS_AMOUNT),
  });

  const pendingPurchase = await aptos.signAndSubmitTransaction({
    signer: buyer,
    transaction,
  });
  await aptos.waitForTransaction({ transactionHash: pendingPurchase.hash });

  await requestJson(
    "/api/purchases",
    {
      body: JSON.stringify({
        packageId,
        paymentTxHash: pendingPurchase.hash,
        walletAddress: buyer.accountAddress.toString(),
      }),
      method: "POST",
    },
    { token: buyerToken },
  );
  logStep("purchase:recorded", {
    packageId,
    transactionHash: pendingPurchase.hash,
  });

  return pendingPurchase.hash;
}

async function downloadArtifact(downloadUrl: string, token: string) {
  const response = await fetch(downloadUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Download failed with status ${response.status}.`);
  }

  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  if (!SHELBY_API_KEY) {
    throw new Error("VITE_SHELBY_API_KEY is required for the Shelby smoke test.");
  }

  const seller = readWallet(SELLER_WALLET_PATH);
  const buyer = readWallet(BUYER_WALLET_PATH);
  const fundingAccount = readWallet(FUNDING_WALLET_PATH);

  await ensureSellerGas(seller, fundingAccount);

  const [sellerToken, buyerToken] = await Promise.all([
    createWalletSession(seller),
    createWalletSession(buyer),
  ]);

  const published = await publishPaidArtifact(seller, sellerToken);
  const resolutionBefore = await getResolution(published.packageId, buyerToken);
  logStep("resolution:before", {
    hasArtifact: Boolean(resolutionBefore.artifact),
    hasPayment: Boolean(resolutionBefore.payment),
    packageId: published.packageId,
  });

  if (!resolutionBefore.payment || resolutionBefore.artifact) {
    throw new Error("Paid artifact should require purchase before download access is granted.");
  }

  const purchaseTxHash = await purchaseArtifact(buyer, buyerToken, published.packageId);
  const resolutionAfter = await getResolution(published.packageId, buyerToken);
  logStep("resolution:after", {
    downloadUrl: resolutionAfter.artifact?.downloadUrl ?? null,
    hasArtifact: Boolean(resolutionAfter.artifact),
    packageId: published.packageId,
  });

  if (!resolutionAfter.artifact?.downloadUrl) {
    throw new Error("Artifact download URL was not unlocked after the on-chain purchase.");
  }

  const downloadedBytes = await downloadArtifact(resolutionAfter.artifact.downloadUrl, buyerToken);

  const result: SmokeResult = {
    buyerAddress: buyer.accountAddress.toStringLong(),
    downloadBytes: downloadedBytes.byteLength,
    packageId: published.packageId,
    priceApt: PRICE_APT,
    purchaseTxHash,
    sellerAddress: seller.accountAddress.toStringLong(),
    title: published.title,
  };

  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        error: error instanceof Error ? error.message : "Unknown smoke failure.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
