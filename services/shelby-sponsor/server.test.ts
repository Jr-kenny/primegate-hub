import { Account } from "@aptos-labs/ts-sdk";

import { getPublicErrorMessage, getSponsorHealthStatus } from "./server.js";

describe("PrimeGate sponsor health", () => {
  const originalPrivateKey = process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY;
  const originalAddress = process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS;
  const originalToken = process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN;

  afterEach(() => {
    if (originalPrivateKey === undefined) {
      delete process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY;
    } else {
      process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = originalPrivateKey;
    }

    if (originalAddress === undefined) {
      delete process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS;
    } else {
      process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = originalAddress;
    }

    if (originalToken === undefined) {
      delete process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN;
    } else {
      process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN = originalToken;
    }
  });

  it("requires the service token and a valid sponsor account", () => {
    const sponsor = Account.generate();
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = sponsor.accountAddress.toString();

    expect(getSponsorHealthStatus()).toEqual({
      sponsorConfigured: false,
      status: "ok",
    });

    process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN = "test-token";

    expect(getSponsorHealthStatus()).toEqual({
      sponsorConfigured: true,
      status: "ok",
    });
  });

  it("reports an address and private key mismatch as unavailable", () => {
    const sponsor = Account.generate();
    const otherAccount = Account.generate();
    process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN = "test-token";
    process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY = sponsor.privateKey.toString();
    process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS = otherAccount.accountAddress.toString();

    expect(getSponsorHealthStatus()).toEqual({
      sponsorConfigured: false,
      status: "ok",
    });
  });

  it("surfaces Aptos balance failures without hiding the VM code", () => {
    const error = Object.assign(new Error("Aptos request failed"), {
      data: {
        error_code: "vm_error",
        message: "Invalid transaction",
        vm_error_code: "INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE",
      },
      name: "AptosApiError",
    });

    expect(getPublicErrorMessage(error)).toBe(
      "Aptos rejected the sponsored transaction (INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE): Invalid transaction",
    );
  });
});
