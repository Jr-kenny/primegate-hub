import { describe, expect, it, vi } from "vitest";

import { assertPrimeGateShelbyRpcReachable } from "./primegate-shelby-rpc";

describe("assertPrimeGateShelbyRpcReachable", () => {
  it("accepts a reachable RPC response even when the probe route is not a GET route", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    await expect(
      assertPrimeGateShelbyRpcReachable(
        "https://shelby.shelbynet.shelby.xyz/shelby",
        "test-api-key",
        fetchImplementation,
      ),
    ).resolves.toBeUndefined();

    expect(fetchImplementation).toHaveBeenCalledWith(
      "https://shelby.shelbynet.shelby.xyz/shelby/v1/multipart-uploads",
      expect.objectContaining({
        headers: {
          Accept: "application/json",
          Authorization: "Bearer test-api-key",
        },
      }),
    );
  });

  it("reports an unreachable endpoint before a wallet transaction is signed", async () => {
    const fetchImplementation = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      assertPrimeGateShelbyRpcReachable(
        "https://api.testnet.shelby.xyz/shelby",
        "test-api-key",
        fetchImplementation,
      ),
    ).rejects.toThrow(
      "The configured Shelby RPC endpoint is unreachable at https://api.testnet.shelby.xyz/shelby. Failed to fetch",
    );
  });
});
