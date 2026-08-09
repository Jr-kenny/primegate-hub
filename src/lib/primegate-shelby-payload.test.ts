import { AccountAddress } from "@aptos-labs/ts-sdk";
import { describe, expect, it } from "vitest";

import { createPrimeGateBatchRegisterBlobsPayload } from "@/lib/primegate-shelby-payload";

describe("PrimeGate Shelby registration payload", () => {
  it("matches the current Shelbynet sponsored batch registration ABI", () => {
    const payload = createPrimeGateBatchRegisterBlobsPayload({
      account: AccountAddress.from("0x1"),
      blobs: [
        {
          blobMerkleRoot: `0x${"11".repeat(32)}`,
          blobName: "packages/example/1.0.0/package.tgz",
          blobSize: 128,
          numChunksets: 1,
        },
      ],
      encoding: 0,
      expirationMicros: 1_800_000_000_000_000,
    });

    expect("function" in payload && payload.function).toContain("::blob_metadata::register_multiple_blobs_with_sponsor");
    expect("functionArguments" in payload && payload.functionArguments).toHaveLength(10);
    expect("functionArguments" in payload && payload.functionArguments?.slice(0, 4)).toEqual([
      ["packages/example/1.0.0/package.tgz"],
      null,
      null,
      1_800_000_000_000_000,
    ]);
  });
});
