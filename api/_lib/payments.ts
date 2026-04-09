import { Aptos, AptosConfig, AccountAddress, Network } from "@aptos-labs/ts-sdk";

import { getPrimeGateRegistryFunctionId, isPrimeGatePackageIdArgument } from "../../src/lib/primegate-registry-contract";
import { AuthError } from "./auth";
import { getSql } from "./database";
import {
  getPrimeGateRegistryContractAddress,
  getPrimeGateRegistryListing,
  hasPrimeGateRegistryPurchase,
} from "./primegate-registry";

const aptos = new Aptos(
  new AptosConfig({
    network: Network.TESTNET,
  }),
);

function normalizeWalletAddress(address: string) {
  return AccountAddress.from(address).toStringLong().toLowerCase();
}

function normalizeTransactionHash(hash: string) {
  const normalized = hash.trim().toLowerCase();
  const prefixed = normalized.startsWith("0x") ? normalized : `0x${normalized}`;

  if (!/^0x[a-f0-9]{1,}$/.test(prefixed)) {
    throw new AuthError("Payment transaction hash is invalid.", 400);
  }

  return prefixed;
}

function transactionTimestampToIso(timestamp: unknown) {
  if (timestamp === null || timestamp === undefined) {
    return new Date().toISOString();
  }

  const milliseconds = Number(BigInt(String(timestamp)) / 1000n);
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : new Date().toISOString();
}

export async function verifyPublishedAssetPayment(input: {
  amountOctas: string;
  packageId: string;
  recipientAddress: string;
  transactionHash: string;
  walletAddress: string;
}) {
  const normalizedTransactionHash = normalizeTransactionHash(input.transactionHash);
  const normalizedBuyerAddress = normalizeWalletAddress(input.walletAddress);
  const normalizedRecipientAddress = normalizeWalletAddress(input.recipientAddress);
  const sql = getSql();

  if (!sql) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const existingRows = (await sql`
    select package_id, wallet_address
    from purchases
    where lower(payment_tx_hash) = lower(${normalizedTransactionHash})
    limit 1
  `) as Record<string, unknown>[];

  if (existingRows.length > 0) {
    const existing = existingRows[0];
    const existingPackageId = String(existing.package_id);
    const existingWalletAddress = normalizeWalletAddress(String(existing.wallet_address));

    if (existingPackageId !== input.packageId || existingWalletAddress !== normalizedBuyerAddress) {
      throw new AuthError("Payment transaction has already been used for another PrimeGate purchase.", 409);
    }
  }

  try {
    await aptos.waitForTransaction({ transactionHash: normalizedTransactionHash });
  } catch {
    throw new AuthError("Payment transaction is not yet confirmed on Aptos testnet.", 400);
  }

  const transaction = await aptos.getTransactionByHash({ transactionHash: normalizedTransactionHash });

  if (transaction.type !== "user_transaction") {
    throw new AuthError("Payment transaction must be a user transaction.", 400);
  }

  if (!transaction.success) {
    throw new AuthError("Payment transaction did not succeed on Aptos testnet.", 400);
  }

  if (normalizeWalletAddress(transaction.sender) !== normalizedBuyerAddress) {
    throw new AuthError("Payment transaction sender does not match the authenticated wallet.", 401);
  }

  const payload = transaction.payload;

  if (!payload || payload.type !== "entry_function_payload") {
    throw new AuthError("Payment transaction payload is not a supported entry function.", 400);
  }

  if (payload.function !== getPrimeGateRegistryFunctionId(getPrimeGateRegistryContractAddress(), "purchase_package")) {
    throw new AuthError("Payment transaction must call the PrimeGate registry purchase function.", 400);
  }

  const functionArguments = Array.isArray(payload.arguments) ? payload.arguments : [];

  if (functionArguments.length < 1) {
    throw new AuthError("Payment transaction arguments are invalid.", 400);
  }

  if (!isPrimeGatePackageIdArgument(functionArguments[0], input.packageId)) {
    throw new AuthError("Payment transaction package id does not match the requested PrimeGate artifact.", 400);
  }

  const listing = await getPrimeGateRegistryListing(input.packageId);
  if (!listing) {
    throw new AuthError("PrimeGate registry listing for this artifact is not active.", 400);
  }

  if (listing.sellerAddress !== normalizedRecipientAddress) {
    throw new AuthError("PrimeGate registry listing seller does not match the package publisher.", 400);
  }

  if (listing.priceOctas.toString() !== input.amountOctas) {
    throw new AuthError("PrimeGate registry listing price does not match the package price.", 400);
  }

  if (!(await hasPrimeGateRegistryPurchase(input.packageId, normalizedBuyerAddress))) {
    throw new AuthError("PrimeGate registry does not show an on-chain purchase receipt for this wallet.", 400);
  }

  return {
    amountOctas: input.amountOctas,
    purchasedAt: transactionTimestampToIso(transaction.timestamp),
    recipientAddress: normalizedRecipientAddress,
    transactionHash: normalizedTransactionHash,
  };
}
