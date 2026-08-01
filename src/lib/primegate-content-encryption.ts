export const PRIMEGATE_CONTENT_ENCRYPTION_VERSION = 1 as const;
export const PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM = "AES-256-GCM-CHUNKED" as const;
export const PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE = 1024 * 1024;
export const PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES = 64;
export const PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES = 16;
export const PRIMEGATE_CONTENT_ENCRYPTION_NONCE_BYTES = 12;

const PRIMEGATE_CONTENT_ENCRYPTION_MAGIC = new Uint8Array([
  80, 71, 69, 78, 67, 48, 48, 49,
]);

export type PrimeGateContentEncryptionKind = "asset" | "manifest";

export type PrimeGateEncryptedBlobDescriptor = {
  nonce: string;
};

export type PrimeGateContentEncryptionManifest = {
  algorithm: typeof PRIMEGATE_CONTENT_ENCRYPTION_ALGORITHM;
  asset: PrimeGateEncryptedBlobDescriptor;
  chunkSize: number;
  headerBytes: typeof PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES;
  manifest: PrimeGateEncryptedBlobDescriptor;
  tagBytes: typeof PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES;
  version: typeof PRIMEGATE_CONTENT_ENCRYPTION_VERSION;
};

export type PrimeGateEncryptionHeader = {
  kind: PrimeGateContentEncryptionKind;
  nonce: Uint8Array;
  plaintextSize: number;
  chunkSize: number;
  chunkCount: number;
  raw: Uint8Array;
};

export type PrimeGateEncryptedStream = {
  ciphertextSize: number;
  nonce: string;
  plaintextSize: number;
  stream: ReadableStream<Uint8Array>;
};

function assertSafeSize(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(label + " must be a non-negative safe integer.");
  }
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, false);
}

function readUint32(view: DataView, offset: number) {
  return view.getUint32(offset, false);
}

function writeUint64(view: DataView, offset: number, value: number) {
  assertSafeSize(value, "Size");
  const high = Math.floor(value / 0x1_0000_0000);
  const low = value - high * 0x1_0000_0000;
  view.setUint32(offset, high, false);
  view.setUint32(offset + 4, low, false);
}

function readUint64(view: DataView, offset: number) {
  const high = view.getUint32(offset, false);
  const low = view.getUint32(offset + 4, false);
  const value = high * 0x1_0000_0000 + low;
  assertSafeSize(value, "Encoded size");
  return value;
}

export function getPrimeGateEncryptionChunkCount(
  plaintextSize: number,
  chunkSize = PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
) {
  assertSafeSize(plaintextSize, "Plaintext size");
  assertSafeSize(chunkSize, "Chunk size");

  if (chunkSize <= 0 || chunkSize > 0xffff_ffff) {
    throw new Error("Chunk size is outside the supported range.");
  }

  return Math.max(1, Math.ceil(plaintextSize / chunkSize));
}

export function getPrimeGateEncryptedSize(
  plaintextSize: number,
  chunkSize = PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
) {
  const chunkCount = getPrimeGateEncryptionChunkCount(plaintextSize, chunkSize);
  const ciphertextSize =
    PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES +
    plaintextSize +
    chunkCount * PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES;

  assertSafeSize(ciphertextSize, "Ciphertext size");
  return ciphertextSize;
}

export function encodePrimeGateBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodePrimeGateBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function createPrimeGateContentKey() {
  return crypto.getRandomValues(new Uint8Array(32));
}

export function createPrimeGateContentNonce() {
  return crypto.getRandomValues(new Uint8Array(PRIMEGATE_CONTENT_ENCRYPTION_NONCE_BYTES));
}

export function createPrimeGateEncryptionHeader(
  kind: PrimeGateContentEncryptionKind,
  plaintextSize: number,
  nonce: Uint8Array,
  chunkSize = PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE,
) {
  assertSafeSize(plaintextSize, "Plaintext size");

  if (nonce.byteLength !== PRIMEGATE_CONTENT_ENCRYPTION_NONCE_BYTES) {
    throw new Error("PrimeGate encryption nonces must be 12 bytes.");
  }

  const header = new Uint8Array(PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES);
  const view = new DataView(header.buffer);
  header.set(PRIMEGATE_CONTENT_ENCRYPTION_MAGIC, 0);
  header[8] = PRIMEGATE_CONTENT_ENCRYPTION_VERSION;
  header[9] = kind === "asset" ? 1 : 2;
  writeUint32(view, 12, chunkSize);
  writeUint64(view, 16, plaintextSize);
  writeUint32(view, 24, getPrimeGateEncryptionChunkCount(plaintextSize, chunkSize));
  header.set(nonce, 28);
  return header;
}

export function parsePrimeGateEncryptionHeader(value: Uint8Array): PrimeGateEncryptionHeader {
  if (value.byteLength !== PRIMEGATE_CONTENT_ENCRYPTION_HEADER_BYTES) {
    throw new Error("PrimeGate encryption header has an invalid length.");
  }

  const copiedValue = new Uint8Array(value);

  for (let index = 0; index < PRIMEGATE_CONTENT_ENCRYPTION_MAGIC.length; index += 1) {
    if (copiedValue[index] !== PRIMEGATE_CONTENT_ENCRYPTION_MAGIC[index]) {
      throw new Error("PrimeGate encryption header magic is invalid.");
    }
  }

  if (copiedValue[8] !== PRIMEGATE_CONTENT_ENCRYPTION_VERSION) {
    throw new Error("PrimeGate encryption version is unsupported.");
  }

  const kind = copiedValue[9] === 1 ? "asset" : copiedValue[9] === 2 ? "manifest" : null;
  if (!kind) {
    throw new Error("PrimeGate encryption blob kind is invalid.");
  }

  const view = new DataView(copiedValue.buffer, copiedValue.byteOffset, copiedValue.byteLength);
  const chunkSize = readUint32(view, 12);
  const plaintextSize = readUint64(view, 16);
  const chunkCount = readUint32(view, 24);
  const nonce = copiedValue.slice(28, 28 + PRIMEGATE_CONTENT_ENCRYPTION_NONCE_BYTES);

  if (chunkCount !== getPrimeGateEncryptionChunkCount(plaintextSize, chunkSize)) {
    throw new Error("PrimeGate encryption chunk count is invalid.");
  }

  return {
    chunkCount,
    chunkSize,
    kind,
    nonce,
    plaintextSize,
    raw: copiedValue,
  };
}

export function derivePrimeGateChunkNonce(baseNonce: Uint8Array, chunkIndex: number) {
  if (baseNonce.byteLength !== PRIMEGATE_CONTENT_ENCRYPTION_NONCE_BYTES) {
    throw new Error("PrimeGate encryption nonces must be 12 bytes.");
  }

  if (!Number.isSafeInteger(chunkIndex) || chunkIndex < 0 || chunkIndex > 0xffff_ffff) {
    throw new Error("PrimeGate encryption chunk index is invalid.");
  }

  const nonce = baseNonce.slice();
  const view = new DataView(nonce.buffer, nonce.byteOffset, nonce.byteLength);
  writeUint32(view, 8, chunkIndex);
  return nonce;
}

export function createPrimeGateChunkAssociatedData(header: Uint8Array, chunkIndex: number) {
  const associatedData = new Uint8Array(header.byteLength + 4);
  associatedData.set(header, 0);
  const view = new DataView(associatedData.buffer);
  writeUint32(view, header.byteLength, chunkIndex);
  return associatedData;
}

async function readPlaintextChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  expectedSize: number,
  pending: { value: Uint8Array | null; offset: number },
) {
  const chunk = new Uint8Array(expectedSize);
  let offset = 0;

  while (offset < expectedSize) {
    if (pending.value && pending.offset < pending.value.byteLength) {
      const copySize = Math.min(expectedSize - offset, pending.value.byteLength - pending.offset);
      chunk.set(pending.value.subarray(pending.offset, pending.offset + copySize), offset);
      pending.offset += copySize;
      offset += copySize;
      continue;
    }

    const next = await reader.read();
    if (next.done) {
      throw new Error("PrimeGate encrypted upload ended before the declared file size.");
    }

    pending.value = next.value;
    pending.offset = 0;
  }

  return chunk;
}

async function assertPlaintextStreamEnded(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  pending: { value: Uint8Array | null; offset: number },
) {
  if (pending.value && pending.offset < pending.value.byteLength) {
    throw new Error("PrimeGate encrypted upload contains more bytes than declared.");
  }

  const next = await reader.read();
  if (!next.done) {
    throw new Error("PrimeGate encrypted upload contains more bytes than declared.");
  }
}

export async function createPrimeGateEncryptedStream(
  input: ReadableStream<Uint8Array>,
  plaintextSize: number,
  kind: PrimeGateContentEncryptionKind,
  contentKey: Uint8Array,
  options: { chunkSize?: number; nonce?: Uint8Array } = {},
): Promise<PrimeGateEncryptedStream> {
  if (contentKey.byteLength !== 32) {
    throw new Error("PrimeGate content keys must be 32 bytes.");
  }

  const chunkSize = options.chunkSize ?? PRIMEGATE_CONTENT_ENCRYPTION_CHUNK_SIZE;
  const nonce = options.nonce ?? createPrimeGateContentNonce();
  const header = createPrimeGateEncryptionHeader(kind, plaintextSize, nonce, chunkSize);
  const chunkCount = getPrimeGateEncryptionChunkCount(plaintextSize, chunkSize);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    contentKey as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const reader = input.getReader();
  const pending = { offset: 0, value: null as Uint8Array | null };
  let headerSent = false;
  let chunkIndex = 0;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    async cancel(reason) {
      await reader.cancel(reason);
    },
    async pull(controller) {
      if (closed) {
        return;
      }

      try {
        if (!headerSent) {
          headerSent = true;
          controller.enqueue(header);
          return;
        }

        if (chunkIndex >= chunkCount) {
          await assertPlaintextStreamEnded(reader, pending);
          closed = true;
          controller.close();
          return;
        }

        const remaining = plaintextSize - chunkIndex * chunkSize;
        const plaintextChunkSize = Math.min(chunkSize, remaining);
        const plaintextChunk = await readPlaintextChunk(reader, plaintextChunkSize, pending);
        const encrypted = await crypto.subtle.encrypt(
          {
            additionalData: createPrimeGateChunkAssociatedData(header, chunkIndex),
            iv: derivePrimeGateChunkNonce(nonce, chunkIndex),
            name: "AES-GCM",
            tagLength: PRIMEGATE_CONTENT_ENCRYPTION_TAG_BYTES * 8,
          },
          cryptoKey,
          plaintextChunk,
        );

        controller.enqueue(new Uint8Array(encrypted));
        chunkIndex += 1;
      } catch (error) {
        closed = true;
        await reader.cancel(error).catch(() => undefined);
        controller.error(error);
      }
    },
  });

  return {
    ciphertextSize: getPrimeGateEncryptedSize(plaintextSize, chunkSize),
    nonce: encodePrimeGateBase64Url(nonce),
    plaintextSize,
    stream,
  };
}

export async function createPrimeGateEncryptedBytesStream(
  bytes: Uint8Array,
  kind: PrimeGateContentEncryptionKind,
  contentKey: Uint8Array,
  options: { chunkSize?: number; nonce?: Uint8Array } = {},
) {
  const input = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });

  return createPrimeGateEncryptedStream(input, bytes.byteLength, kind, contentKey, options);
}
