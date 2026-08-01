import { describe, expect, it } from "vitest";

import {
  buildPrimeGatePublisherBillingSummary,
  formatPrimeGateBytes,
} from "./publisher-billing";

describe("publisher billing", () => {
  it("keeps reservations visible while preserving the free allowance", () => {
    const summary = buildPrimeGatePublisherBillingSummary({
      creditBytesAvailable: 256,
      creditBytesReserved: 64,
      egressBytesIncluded: 5_000,
      egressBytesUsed: 1_000,
      periodEndsAt: new Date("2026-09-01T00:00:00.000Z"),
      periodStartsAt: new Date("2026-08-01T00:00:00.000Z"),
      planName: "Free",
      planSlug: "free",
      planStatus: "active",
      publishBytesIncluded: 1_000,
      publishBytesReserved: 200,
      publishBytesUsed: 300,
      paymentRail: "not-configured",
    });

    expect(summary.model).toBe("hybrid");
    expect(summary.publish.remainingBytes).toBe(500);
    expect(summary.egress.remainingBytes).toBe(4_000);
    expect(summary.credits.availableBytes).toBe(256);
    expect(summary.credits.reservedBytes).toBe(64);
  });

  it("formats publisher byte allowances for the workspace", () => {
    expect(formatPrimeGateBytes(512)).toBe("512 B");
    expect(formatPrimeGateBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatPrimeGateBytes(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});
