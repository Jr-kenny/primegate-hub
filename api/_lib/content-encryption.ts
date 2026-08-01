import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import {
  createPrimeGateChunkAssociatedData,
  derivePrimeGateChunkNonce,
  parsePrimeGateEncryptionHeader,
  PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM,
  PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES,
  PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES,
  type PrimeGateContentEncryptionKind,
  type PrimeGateContentEncryptionManifest,
  type PrimeGateEncryptionHeader,
} from "../../src/lib/primegate-content-encryption.js";
import { readPrimeGateEnvValue } from "../../src/lib/primegate-env.js";

const PRIMEGATE_CONTENT_KEY_ENVELOPE_VERSION = 1;
const PRIMEGATE_CONTENT_KEY_ENVELOPE_ALGORITHM = "AES-256-GCM";
const PRIMEGATE_CONTENT_KEY_ENVELOPE_AAD = Buffer.from(
  "primegate-content-key-envelope:v1",
  "utf8",
);

export type PrimeGateEncryptedBlobRange = {
  end: number;
  start: number;
};

export type PrimeGateEncryptedBlobDownload = {
  readable: AsyncIterable<Uint8Array | string>;
};

export type PrimeGateEncryptedBlobDownloader = (
  range?: PrimeGateEncryptedBlobRange,
) => Promise<PrimeGateEncryptedBlobDownload>;

export type PrimeGateEncryptedBlobStats = {
  ciphertextSize: number;
  header: PrimeGateEncryptionHeader;
  plaintextSize: number;
  sha256: string;
};

function getContentKeyWrappingKey() {
  const secret = readPrimeGateEnvValue(process.env.PRIMEGATE_CONTENT_KEY_SECRET);

  if (!secret || secret.length < 32) {
    throw new Error(
      "PRIMEGATE_CONTENT_KEY_SECRET must be configured with at least 32 characters.",
    );
  }

  return createHash("sha256").update("primegate-content-key:" + secret, "utf8").digest();
}

export function isPrimeGateContentEncryptionConfigured() {
  const secret = readPrimeGateEnvValue(process.env.PRIMEGATE_CONTENT_KEY_SECRET);
  return Boolean(secret && secret.length >= 32);
}

function toBase64Url(value: Uint8Array) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url");
}

function assertContentKey(value: Uint8Array) {
  if (value.byteLength !== 32) {
    throw new Error("PrimeGate content keys must be 32 bytes.");
  }
}

export function wrapPrimeGateContentKey(contentKey: Uint8Array) {
  assertContentKey(contentKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getContentKeyWrappingKey(), iv);
  cipher.setAAD(PRIMEGATE_CONTENT_KEY_ENVELOPE_AAD);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(contentKey)), cipher.final()]);

  return JSON.stringify({
    algorithm: PRIMEGATE_CONTENT_KEY_ENVELOPE_ALGORITHM,
    ciphertext: toBase64Url(ciphertext),
    iv: toBase64Url(iv),
    tag: toBase64Url(cipher.getAuthTag()),
    version: PRIMEGATE_CONTENT_KEY_ENVELOPE_VERSION,
  });
}

export function unwrapPrimeGateContentKey(envelope: string) {
  let parsed: {
    algorithm?: unknown;
    ciphertext?: unknown;
    iv?: unknown;
    tag?: unknown;
    version?: unknown;
  };

  try {
    parsed = JSON.parse(envelope) as typeof parsed;
  } catch {
    throw new Error("PrimeGate content key envelope is invalid JSON.");
  }

  if (
    parsed.version !== PRIMEGATE_CONTENT_KEY_ENVELOPE_VERSION ||
    parsed.algorithm !== PRIMEGATE_CONTENT_KEY_ENVELOPE_ALGORITHM ||
    typeof parsed.ciphertext !== "string" ||
    typeof parsed.iv !== "string" ||
    typeof parsed.tag !== "string"
  ) {
    throw new Error("PrimeGate content key envelope format is unsupported.");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      getContentKeyWrappingKey(),
      fromBase64Url(parsed.iv),
    );
    decipher.setAAD(PRIMEGATE_CONTENT_KEY_ENVELOPE_AAD);
    decipher.setAuthTag(fromBase64Url(parsed.tag));
    const contentKey = Buffer.concat([
      decipher.update(fromBase64Url(parsed.ciphertext)),
      decipher.final(),
    ]);
    assertContentKey(contentKey);
    return contentKey;
  } catch {
    throw new Error("PrimeGate content key envelope could not be opened.");
  }
}

function toBytes(chunk: Uint8Array | string) {
  return typeof chunk === "string" ? Buffer.from(chunk, "utf8") : Buffer.from(chunk);
}

class PrimeGateAsyncByteReader {
  private readonly iterator: AsyncIterator<Uint8Array | string>;
  private pending = Buffer.alloc(0);
  private pendingOffset = 0;

  constructor(readable: AsyncIterable<Uint8Array | string>) {
    this.iterator = readable[Symbol.asyncIterator]();
  }

  async readExactly(length: number) {
    const output = Buffer.alloc(length);
    let offset = 0;

    while (offset < length) {
      if (this.pendingOffset < this.pending.byteLength) {
        const copySize = Math.min(length - offset, this.pending.byteLength - this.pendingOffset);
        this.pending.copy(output, offset, this.pendingOffset, this.pendingOffset + copySize);
        this.pendingOffset += copySize;
        offset += copySize;
        continue;
      }

      const next = await this.iterator.next();
      if (next.done) {
        throw new Error("PrimeGate encrypted blob ended before the expected bytes were read.");
      }

      this.pending = toBytes(next.value);
      this.pendingOffset = 0;
    }

    return output;
  }

  async assertEnded() {
    if (this.pendingOffset < this.pending.byteLength) {
      throw new Error("PrimeGate encrypted blob contains unexpected trailing bytes.");
    }

    const next = await this.iterator.next();
    if (!next.done) {
      throw new Error("PrimeGate encrypted blob contains unexpected trailing bytes.");
    }
  }
}

function getPlaintextChunkSize(header: PrimeGateEncryptionHeader, chunkIndex: number) {
  const remaining = header.plaintextSize - chunkIndex * header.chunkSize;
  return Math.max(0, Math.min(header.chunkSize, remaining));
}

function getCiphertextChunkOffset(header: PrimeGateEncryptionHeader, chunkIndex: number) {
  return (
    PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES +
    chunkIndex * (header.chunkSize + PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES)
  );
}

function getCiphertextChunkSize(header: PrimeGateEncryptionHeader, chunkIndex: number) {
  return getPlaintextChunkSize(header, chunkIndex) + PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES;
}

function decryptPrimeGateChunk(
  ciphertext: Uint8Array,
  header: PrimeGateEncryptionHeader,
  contentKey: Uint8Array,
  chunkIndex: number,
) {
  assertContentKey(contentKey);

  if (ciphertext.byteLength < PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES) {
    throw new Error("PrimeGate encrypted chunk is shorter than its authentication tag.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(contentKey),
    Buffer.from(derivePrimeGateChunkNonce(header.nonce, chunkIndex)),
  );
  decipher.setAAD(
    Buffer.from(createPrimeGateChunkAssociatedData(header.raw, chunkIndex)),
  );
  decipher.setAuthTag(
    Buffer.from(ciphertext.slice(ciphertext.byteLength - PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES)),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(ciphertext.slice(0, ciphertext.byteLength - PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES)),
    ),
    decipher.final(),
  ]);
}

function validatePrimeGateEncryptedHeader(
  header: PrimeGateEncryptionHeader,
  expectedKind: PrimeGateContentEncryptionKind,
  expectedPlaintextSize?: number,
  expectedNonce?: string,
) {
  if (header.kind !== expectedKind) {
    throw new Error("PrimeGate encrypted blob kind does not match the registry record.");
  }

  if (
    expectedPlaintextSize !== undefined &&
    header.plaintextSize !== expectedPlaintextSize
  ) {
    throw new Error("PrimeGate encrypted blob size does not match the registry record.");
  }

  if (
    expectedNonce &&
    Buffer.from(header.nonce).toString("base64url") !== expectedNonce
  ) {
    throw new Error("PrimeGate encrypted blob nonce does not match the registry record.");
  }
}

async function* decryptPrimeGateReadable(
  readable: AsyncIterable<Uint8Array | string>,
  contentKey: Uint8Array,
  expectedKind: PrimeGateContentEncryptionKind,
  options: {
    endChunk?: number;
    expectedNonce?: string;
    expectedPlaintextSize?: number;
    header?: PrimeGateEncryptionHeader;
    range?: PrimeGateEncryptedBlobRange;
    startChunk?: number;
  } = {},
) {
  const reader = new PrimeGateAsyncByteReader(readable);
  const header = options.header ?? parsePrimeGateEncryptionHeader(
    await reader.readExactly(PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES),
  );
  validatePrimeGateEncryptedHeader(
    header,
    expectedKind,
    options.expectedPlaintextSize,
    options.expectedNonce,
  );

  const startChunk = options.startChunk ?? 0;
  const endChunk = options.endChunk ?? header.chunkCount - 1;

  if (
    startChunk < 0 ||
    endChunk < startChunk ||
    endChunk >= header.chunkCount
  ) {
    throw new Error("PrimeGate encrypted chunk range is invalid.");
  }

  for (let chunkIndex = startChunk; chunkIndex <= endChunk; chunkIndex += 1) {
    const encryptedChunk = await reader.readExactly(
      getCiphertextChunkSize(header, chunkIndex),
    );
    const plaintextChunk = decryptPrimeGateChunk(
      encryptedChunk,
      header,
      contentKey,
      chunkIndex,
    );

    if (!options.range) {
      yield plaintextChunk;
      continue;
    }

    const chunkStart = chunkIndex * header.chunkSize;
    const sliceStart = Math.max(options.range.start - chunkStart, 0);
    const sliceEnd = Math.min(
      options.range.end - chunkStart + 1,
      plaintextChunk.byteLength,
    );

    if (sliceEnd > sliceStart) {
      yield plaintextChunk.slice(sliceStart, sliceEnd);
    }
  }

  await reader.assertEnded();
}

function createPrimeGateReadableStream(
  generator: AsyncGenerator<Uint8Array>,
) {
  const iterator = generator[Symbol.asyncIterator]();

  return new ReadableStream<Uint8Array>({
    async cancel() {
      await iterator.return?.();
    },
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) {
          controller.close();
          return;
        }

        controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

export async function readPrimeGateEncryptedBlobHeader(
  download: PrimeGateEncryptedBlobDownloader,
) {
  const blob = await download({
    end: PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES - 1,
    start: 0,
  });
  const reader = new PrimeGateAsyncByteReader(blob.readable);
  const header = parsePrimeGateEncryptionHeader(
    await reader.readExactly(PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES),
  );
  await reader.assertEnded();
  return header;
}

export async function readPrimeGateEncryptedBlobBytes(
  download: PrimeGateEncryptedBlobDownloader,
  contentKey: Uint8Array,
  expectedKind: PrimeGateContentEncryptionKind,
  options: { expectedNonce?: string; expectedPlaintextSize?: number } = {},
) {
  const blob = await download();
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of decryptPrimeGateReadable(
    blob.readable,
    contentKey,
    expectedKind,
    options,
  )) {
    const bytes = Buffer.from(chunk);
    chunks.push(bytes);
    size += bytes.byteLength;
  }

  return Buffer.concat(chunks, size);
}

export async function hashPrimeGateEncryptedBlob(
  download: PrimeGateEncryptedBlobDownloader,
  contentKey: Uint8Array,
  expectedKind: PrimeGateContentEncryptionKind,
  options: { expectedNonce?: string; expectedPlaintextSize?: number } = {},
): Promise<PrimeGateEncryptedBlobStats> {
  const blob = await download();
  const reader = new PrimeGateAsyncByteReader(blob.readable);
  const header = parsePrimeGateEncryptionHeader(
    await reader.readExactly(PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES),
  );
  validatePrimeGateEncryptedHeader(
    header,
    expectedKind,
    options.expectedPlaintextSize,
    options.expectedNonce,
  );

  const hash = createHash("sha256");
  let plaintextSize = 0;
  let ciphertextSize = PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES;

  for (let chunkIndex = 0; chunkIndex < header.chunkCount; chunkIndex += 1) {
    const encryptedChunk = await reader.readExactly(
      getCiphertextChunkSize(header, chunkIndex),
    );
    const plaintextChunk = decryptPrimeGateChunk(
      encryptedChunk,
      header,
      contentKey,
      chunkIndex,
    );
    hash.update(plaintextChunk);
    plaintextSize += plaintextChunk.byteLength;
    ciphertextSize += encryptedChunk.byteLength;
  }

  await reader.assertEnded();

  if (plaintextSize !== header.plaintextSize) {
    throw new Error("PrimeGate encrypted blob plaintext size verification failed.");
  }

  return {
    ciphertextSize,
    header,
    plaintextSize,
    sha256: "0x" + hash.digest("hex"),
  };
}

export async function openPrimeGateDecryptedBlobStream(
  download: PrimeGateEncryptedBlobDownloader,
  contentKey: Uint8Array,
  expectedKind: PrimeGateContentEncryptionKind,
  options: {
    encryption?: PrimeGateContentEncryptionManifest;
    range?: PrimeGateEncryptedBlobRange;
    expectedPlaintextSize?: number;
    expectedNonce?: string;
  } = {},
) {
  if (!options.range) {
    const blob = await download();
    return {
      plaintextSize: options.expectedPlaintextSize,
      stream: createPrimeGateReadableStream(
        decryptPrimeGateReadable(blob.readable, contentKey, expectedKind, {
          expectedNonce: options.expectedNonce,
          expectedPlaintextSize: options.expectedPlaintextSize,
        }),
      ),
    };
  }

  const header = await readPrimeGateEncryptedBlobHeader(download);
  validatePrimeGateEncryptedHeader(
    header,
    expectedKind,
    options.expectedPlaintextSize,
    options.expectedNonce,
  );

  const firstChunk = Math.floor(options.range.start / header.chunkSize);
  const lastChunk = Math.floor(options.range.end / header.chunkSize);
  const ciphertextStart = getCiphertextChunkOffset(header, firstChunk);
  const ciphertextEnd =
    getCiphertextChunkOffset(header, lastChunk) +
    getCiphertextChunkSize(header, lastChunk) -
    1;
  const blob = await download({
    end: ciphertextEnd,
    start: ciphertextStart,
  });

  return {
    plaintextSize: options.range.end - options.range.start + 1,
    stream: createPrimeGateReadableStream(
      decryptPrimeGateReadable(blob.readable, contentKey, expectedKind, {
        endChunk: lastChunk,
        expectedNonce: options.expectedNonce,
        expectedPlaintextSize: options.expectedPlaintextSize,
        header,
        range: options.range,
        startChunk: firstChunk,
      }),
    ),
  };
}

export function assertPrimeGateContentEncryptionManifest(
  encryption: PrimeGateContentEncryptionManifest,
) {
  if (
    encryption.algorithm !== PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM ||
    encryption.version !== 1 ||
    encryption.headerBytes !== PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES ||
    encryption.tagBytes !== PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES ||
    encryption.chunkSize <= 0 ||
    !encryption.asset?.nonce ||
    !encryption.manifest?.nonce
  ) {
    throw new Error("PrimeGate content encryption metadata is invalid.");
  }

  const assetNonce = Buffer.from(encryption.asset.nonce, "base64url");
  const manifestNonce = Buffer.from(encryption.manifest.nonce, "base64url");
  if (assetNonce.byteLength !== 12 || manifestNonce.byteLength !== 12) {
    throw new Error("PrimeGate content encryption metadata contains an invalid nonce.");
  }

  if (assetNonce.equals(manifestNonce)) {
    throw new Error("PrimeGate asset and manifest encryption nonces must differ.");
  }
}
