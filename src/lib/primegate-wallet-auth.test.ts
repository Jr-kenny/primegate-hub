import { describe, expect, it } from "vitest";

import {
  getPrimeGateWalletAuthChainId,
  shouldUsePrimeGateWalletMessageAuth,
} from "./primegate-wallet-auth";

describe("PrimeGate wallet authentication", () => {
  it("uses SIWA when the wallet is already on the application network", () => {
    expect(shouldUsePrimeGateWalletMessageAuth(true, true)).toBe(false);
  });

  it("uses network-independent message signing when a SIWA wallet is on another network", () => {
    expect(shouldUsePrimeGateWalletMessageAuth(true, false)).toBe(true);
  });

  it("uses message signing when the wallet does not support SIWA", () => {
    expect(shouldUsePrimeGateWalletMessageAuth(false, true)).toBe(true);
  });

  it("reads decimal and hexadecimal Aptos chain IDs", () => {
    expect(getPrimeGateWalletAuthChainId({ chainId: 2 })).toBe(2);
    expect(getPrimeGateWalletAuthChainId({ chainId: "0x76" })).toBe(118);
  });

  it("rejects missing and invalid chain IDs", () => {
    expect(getPrimeGateWalletAuthChainId(null)).toBeNull();
    expect(getPrimeGateWalletAuthChainId({ chainId: "unknown" })).toBeNull();
    expect(getPrimeGateWalletAuthChainId({ chainId: 0 })).toBeNull();
  });
});
