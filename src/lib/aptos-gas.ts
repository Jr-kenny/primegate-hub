import { readPrimeGateEnvValue } from "./primegate-env";

type PrimeGateGasEstimate = {
  gas_estimate?: number | string;
  prioritized_gas_estimate?: number | string;
};

export type PrimeGateTransactionOptions = {
  gasUnitPrice: number;
  maxGasAmount: number;
};

const DEFAULT_APTOS_FULLNODE_URL = "https://api.testnet.aptoslabs.com/v1";
const FALLBACK_GAS_UNIT_PRICE = 100;

function getAptosFullnodeUrl() {
  return readPrimeGateEnvValue(process.env.VITE_APTOS_FULLNODE_URL) || DEFAULT_APTOS_FULLNODE_URL;
}

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

export async function getPrimeGateTransactionOptions(
  maxGasAmount: number,
): Promise<PrimeGateTransactionOptions> {
  try {
    const response = await fetch(`${getAptosFullnodeUrl()}/estimate_gas_price`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Aptos fullnode request failed with status ${response.status}.`);
    }

    const gasEstimate = (await response.json()) as PrimeGateGasEstimate;
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
