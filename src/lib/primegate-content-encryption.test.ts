import { describe, expect, it } from "vitest";
import { Buffer } from "node:buffer";

import {
  createPrimeGateEncryptedBytesStream,
  parsePrimeGateEncryptionHeader,
  PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
} from "./primegate-content-encryption";

async function readStream(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const next = await reader.read();
    if (next.done) {
      break;
    }

    chunks.push(next.value);
    size += next.value.byteLength;
  }

  const output = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return output;
}

describe("PrimeGate content encryption", () => {
  it("produces deterministic authenticated chunks and the expected ciphertext size", async () => {
    const plaintext = new TextEncoder().encode("primegate protected release bytes");
    const key = new Uint8Array(32).fill(7);
    const nonce = new Uint8Array(12).fill(9);
    const first = await createPrimeGateEncryptedBytesStream(plaintext, "asset", key, {
      chunkSize: 8,
      nonce,
    });
    const second = await createPrimeGateEncryptedBytesStream(plaintext, "asset", key, {
      chunkSize: 8,
      nonce,
    });
    const firstBytes = await readStream(first.stream);
    const secondBytes = await readStream(second.stream);
    const header = parsePrimeGateEncryptionHeader(
      Buffer.from(firstBytes.slice(0, PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES)),
    );

    expect(firstBytes).toEqual(secondBytes);
    expect(header.kind).toBe("asset");
    expect(header.plaintextSize).toBe(plaintext.byteLength);
    expect(header.chunkSize).toBe(8);
    expect(firstBytes.byteLength).toBe(first.ciphertextSize);
    expect(firstBytes.byteLength).toBe(
      PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES +
        plaintext.byteLength +
        header.chunkCount * PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
    );
  });
});
