import { describe, expect, it } from "vitest";

import {
  PrimeGatePublishError,
  getPrimeGatePublishErrorMessage,
  withPrimeGatePublishStage,
} from "@/lib/primegate-publish-error";

describe("PrimeGate publish errors", () => {
  it("preserves wallet adapter errors thrown as strings", () => {
    expect(getPrimeGatePublishErrorMessage("User has rejected the request")).toBe(
      "User has rejected the request",
    );
  });

  it("reads structured API error messages", () => {
    expect(
      getPrimeGatePublishErrorMessage({
        data: { message: "Invalid transaction" },
      }),
    ).toBe("Invalid transaction");
  });

  it("adds the failing publish stage", async () => {
    await expect(
      withPrimeGatePublishStage("sponsor submission", async () => {
        throw "INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE";
      }),
    ).rejects.toMatchObject({
      message: "PrimeGate sponsor submission failed: INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE",
      name: "PrimeGatePublishError",
      stage: "sponsor submission",
    } satisfies Partial<PrimeGatePublishError>);
  });
});
