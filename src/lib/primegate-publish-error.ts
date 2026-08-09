export type PrimeGatePublishErrorStage =
  | "wallet session"
  | "wallet network"
  | "publish intent"
  | "Shelby RPC preflight"
  | "Shelby commitments"
  | "Shelby sponsor configuration"
  | "Shelby transaction preparation"
  | "wallet signature"
  | "sponsor submission"
  | "Shelby registration confirmation"
  | "Shelby blob upload"
  | "PrimeGate finalization"
  | "paid listing";

export class PrimeGatePublishError extends Error {
  readonly stage: PrimeGatePublishErrorStage;

  constructor(stage: PrimeGatePublishErrorStage, cause: unknown) {
    const message = getPrimeGatePublishErrorMessage(cause);
    super(`PrimeGate ${stage} failed: ${message}`);
    this.name = "PrimeGatePublishError";
    this.stage = stage;
  }
}

export function getPrimeGatePublishErrorMessage(error: unknown) {
  if (error instanceof PrimeGatePublishError) {
    return error.message;
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (error && typeof error === "object") {
    const value = error as {
      data?: { message?: unknown };
      error?: unknown;
      message?: unknown;
    };

    if (typeof value.message === "string" && value.message.trim()) {
      return value.message.trim();
    }

    if (typeof value.data?.message === "string" && value.data.message.trim()) {
      return value.data.message.trim();
    }

    if (typeof value.error === "string" && value.error.trim()) {
      return value.error.trim();
    }
  }

  return "Unknown error.";
}

export async function withPrimeGatePublishStage<T>(
  stage: PrimeGatePublishErrorStage,
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof PrimeGatePublishError) {
      throw error;
    }

    throw new PrimeGatePublishError(stage, error);
  }
}
