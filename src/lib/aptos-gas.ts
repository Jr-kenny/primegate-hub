import type { Aptos, InputGenerateTransactionOptions } from "@aptos-labs/ts-sdk";

const FALLBACK_GAS_UNIT_PRICE = 100;

function toPositiveInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.ceil(parsed) : null;
}

export async function getPrimeGateTransactionOptions(
  aptos: Pick<Aptos, "getGasPriceEstimation">,
  maxGasAmount: number,
): Promise<InputGenerateTransactionOptions> {
  try {
    const gasEstimate = await aptos.getGasPriceEstimation();

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
