import { describe, expect, it, vi } from "vitest";

import {
  isPrimeGateTransactionNetwork,
  requestPrimeGateTransactionNetwork,
} from "@/lib/primegate-wallet-network";

describe("PrimeGate transaction network", () => {
  it("requests the complete custom Shelbynet network", async () => {
    const changeNetwork = vi.fn().mockResolvedValue({
      args: { success: true },
      status: "Approved",
    });

    await requestPrimeGateTransactionNetwork(
      { "aptos:changeNetwork": { changeNetwork } },
      "Nightly",
    );

    expect(changeNetwork).toHaveBeenCalledWith({
      chainId: 118,
      name: "shelbynet",
      url: "https://api.shelbynet.shelby.xyz/v1",
    });
  });

  it("rejects a wallet that remains on Aptos Testnet", () => {
    expect(isPrimeGateTransactionNetwork({ chainId: 2, name: "testnet" })).toBe(false);
    expect(isPrimeGateTransactionNetwork({ chainId: 118, name: "shelbynet" })).toBe(true);
  });

  it("reports wallets that cannot switch networks", async () => {
    await expect(requestPrimeGateTransactionNetwork({}, "Nightly")).rejects.toThrow(
      "Nightly cannot switch to Shelbynet for PrimeGate transactions.",
    );
  });
});
