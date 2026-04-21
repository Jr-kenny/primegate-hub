import { PRIMEGATE_APTOS_FULLNODE_URL } from "@/config/web3-constants";

type PrimeGateGasEstimate = {
  gas_estimate?: number | string;
  prioritized_gas_estimate?: number | string;
};

type PrimeGateTransactionResponse = {
  hash?: string;
  success?: boolean;
  type?: string;
  vm_status?: string;
};

export type PrimeGateTransactionOptions = {
  gasUnitPrice: number;
  maxGasAmount: number;
};

const DEFAULT_WAIT_TIMEOUT_MS = 20_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;
const FALLBACK_GAS_UNIT_PRICE = 100;

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

async function fetchAptosJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${PRIMEGATE_APTOS_FULLNODE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Aptos fullnode request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

export async function getPrimeGateTransactionOptions(
  maxGasAmount: number,
): Promise<PrimeGateTransactionOptions> {
  try {
    const gasEstimate = await fetchAptosJson<PrimeGateGasEstimate>("/estimate_gas_price");

    return {
      gasUnitPrice:
        toPositiveInteger(gasEstimate.gas_estimate) ??
        toPositiveInteger(gasEstimate.prioritized_gas_estimate) ??
        FALLBACK_GAS_UNIT_PRICE,
      maxGasAmount,
    };
  } catch {
    return {
      gasUnitPrice: FALLBACK_GAS_UNIT_PRICE,
      maxGasAmount,
    };
  }
}

export async function waitForPrimeGateTransaction(
  transactionHash: string,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  }: { pollIntervalMs?: number; timeoutMs?: number } = {},
) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await fetch(`${PRIMEGATE_APTOS_FULLNODE_URL}/transactions/by_hash/${transactionHash}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
      continue;
    }

    if (!response.ok) {
      throw new Error(`Aptos transaction lookup failed with status ${response.status}.`);
    }

    const transaction = (await response.json()) as PrimeGateTransactionResponse;
    if (transaction.type === "pending_transaction" || typeof transaction.success !== "boolean") {
      await new Promise((resolve) => window.setTimeout(resolve, pollIntervalMs));
      continue;
    }

    if (!transaction.success) {
      throw new Error(transaction.vm_status || "Aptos transaction failed.");
    }

    return transaction;
  }

  throw new Error("Timed out while waiting for the Aptos transaction to complete.");
}
