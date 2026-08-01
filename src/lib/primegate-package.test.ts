import { describe, expect, it } from "vitest";

import {
  comparePrimeGateReleaseVersions,
  normalizePrimeGateReleaseChannel,
  normalizePrimeGateReleaseVersion,
} from "@/lib/primegate-package";

describe("PrimeGate release identity", () => {
  it("accepts SemVer releases and rejects ambiguous versions", () => {
    expect(normalizePrimeGateReleaseVersion("1.4.0-beta.1")).toBe("1.4.0-beta.1");
    expect(() => normalizePrimeGateReleaseVersion("v1.4")).toThrow();
  });

  it("orders stable releases after prereleases", () => {
    expect(comparePrimeGateReleaseVersions("1.4.0", "1.4.0-rc.1")).toBeGreaterThan(0);
    expect(comparePrimeGateReleaseVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(comparePrimeGateReleaseVersions("1.0.0-alpha.2", "1.0.0-alpha.10")).toBeLessThan(0);
  });

  it("normalizes supported release channels", () => {
    expect(normalizePrimeGateReleaseChannel(" BETA ")).toBe("beta");
    expect(() => normalizePrimeGateReleaseChannel("preview")).toThrow();
  });
});
