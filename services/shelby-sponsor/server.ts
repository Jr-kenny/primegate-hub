import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  SponsorConfigurationError,
  SponsorTransactionError,
  getManagedStorageAccountAddress,
  getSponsorAccountAddress,
  getSponsorFundingStatus,
  submitServerOwnedShelbyCommit,
  submitServerOwnedShelbyRegistration,
  submitSponsoredPrimeGateListingTransaction,
  submitSponsoredShelbyTransaction,
  type SponsoredTransactionInput,
} from "./transaction.js";

const MAX_REQUEST_BYTES = 128 * 1024;

type SponsorRequestBody = Record<string, unknown>;

function getServiceToken() {
  return process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN?.trim() ?? "";
}

function writeJson(response: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(payload);
}

export function getSponsorHealthStatus() {
  let sponsorConfigured = false;

  try {
    sponsorConfigured = Boolean(
      getServiceToken() &&
        process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS?.trim() &&
        getSponsorAccountAddress(),
    );
  } catch {
    sponsorConfigured = false;
  }

  return {
    sponsorConfigured,
    status: "ok" as const,
  };
}

export async function getSponsorReadinessStatus() {
  const health = getSponsorHealthStatus();

  if (!health.sponsorConfigured) {
    return {
      ...health,
      fundingReady: false,
    };
  }

  try {
    const funding = await getSponsorFundingStatus();
    return {
      ...health,
      fundingReady: funding.aptosReady && funding.listingAptosReady && funding.shelbyUsdReady,
    };
  } catch {
    return {
      ...health,
      fundingReady: false,
    };
  }
}

async function writeHealthResponse(response: ServerResponse, includeBody: boolean) {
  const payload = JSON.stringify(await getSponsorReadinessStatus());

  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (includeBody) {
    response.setHeader("Content-Length", Buffer.byteLength(payload));
    response.end(payload);
    return;
  }

  response.end();
}

function isAuthorized(request: IncomingMessage) {
  const configuredToken = getServiceToken();
  const suppliedToken = request.headers["x-primegate-sponsor-token"];
  const token = Array.isArray(suppliedToken) ? suppliedToken[0] : suppliedToken;

  if (!configuredToken || !token) {
    return false;
  }

  const configured = Buffer.from(configuredToken, "utf8");
  const supplied = Buffer.from(token, "utf8");

  return configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

function readRequestBody(request: IncomingMessage) {
  return new Promise<string>((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];

    request.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buffer.length;

      if (size > MAX_REQUEST_BYTES) {
        reject(new SponsorTransactionError("The sponsor request is too large.", 413));
        request.destroy();
        return;
      }

      chunks.push(buffer);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function parseRequestBody(rawBody: string): SponsoredTransactionInput {
  let body: SponsorRequestBody;

  try {
    body = JSON.parse(rawBody) as SponsorRequestBody;
  } catch {
    throw new SponsorTransactionError("The sponsor request body was not valid JSON.", 400);
  }

  if (typeof body.operation !== "string" || typeof body.walletAddress !== "string") {
    throw new SponsorTransactionError("The sponsor request was missing required transaction fields.", 400);
  }

  if (body.operation === "shelby-registration-v2") {
    if (
      typeof body.storageAccount !== "string" ||
      !Array.isArray(body.expectedBlobNames) ||
      body.expectedBlobNames.some((name) => typeof name !== "string") ||
      !Array.isArray(body.blobs) ||
      typeof body.encoding !== "number" ||
      typeof body.expirationMicros !== "number"
    ) {
      throw new SponsorTransactionError("The Shelby sponsor request was incomplete.", 400);
    }

    return {
      blobs: body.blobs as Array<{
        blobMerkleRoot: string;
        blobName: string;
        blobSize: number;
        numChunksets: number;
      }>,
      encoding: body.encoding,
      expectedBlobNames: body.expectedBlobNames,
      expirationMicros: body.expirationMicros,
      operation: "shelby-registration-v2",
      storageAccount: body.storageAccount,
      walletAddress: body.walletAddress,
    };
  }

  if (body.operation === "shelby-commit-v2") {
    if (
      typeof body.storageAccount !== "string" ||
      typeof body.blobName !== "string" ||
      typeof body.uid !== "string" ||
      !Array.isArray(body.storageProviderAcks)
    ) {
      throw new SponsorTransactionError("The Shelby commit sponsor request was incomplete.", 400);
    }

    return {
      blobName: body.blobName,
      operation: "shelby-commit-v2",
      storageAccount: body.storageAccount,
      storageProviderAcks: body.storageProviderAcks as Array<{
        signature: string;
        slot: number;
      }>,
      uid: body.uid,
      walletAddress: body.walletAddress,
    };
  }

  if (typeof body.transactionHex !== "string" || typeof body.senderAuthenticatorHex !== "string") {
    throw new SponsorTransactionError("The sponsor request was missing required transaction fields.", 400);
  }

  if (body.operation === "shelby-registration") {
    if (
      !Array.isArray(body.expectedBlobNames) ||
      body.expectedBlobNames.some((name) => typeof name !== "string")
    ) {
      throw new SponsorTransactionError("The Shelby sponsor request was missing blob names.", 400);
    }

    return {
      expectedBlobNames: body.expectedBlobNames,
      operation: "shelby-registration",
      senderAuthenticatorHex: body.senderAuthenticatorHex,
      transactionHex: body.transactionHex,
      walletAddress: body.walletAddress,
    };
  }

  if (body.operation === "primegate-listing") {
    if (typeof body.expectedPackageId !== "string" || typeof body.expectedPriceOctas !== "string") {
      throw new SponsorTransactionError("The PrimeGate listing sponsor request was incomplete.", 400);
    }

    return {
      expectedPackageId: body.expectedPackageId,
      expectedPriceOctas: body.expectedPriceOctas,
      operation: "primegate-listing",
      senderAuthenticatorHex: body.senderAuthenticatorHex,
      transactionHex: body.transactionHex,
      walletAddress: body.walletAddress,
    };
  }

  throw new SponsorTransactionError("The sponsor operation is not supported.", 400);
}

function isAptosApiError(error: unknown): error is {
  data?: { error_code?: unknown; message?: unknown; vm_error_code?: unknown };
  message?: string;
  name?: string;
} {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as { data?: unknown; name?: unknown };
  return value.name === "AptosApiError" || Boolean(value.data && typeof value.data === "object");
}

function getErrorStatus(error: unknown) {
  if (error instanceof SponsorTransactionError || error instanceof SponsorConfigurationError) {
    return error.status;
  }

  if (isAptosApiError(error)) {
    return 502;
  }

  return 500;
}

export function getPublicErrorMessage(error: unknown) {
  if (error instanceof SponsorTransactionError || error instanceof SponsorConfigurationError) {
    return error.message;
  }

  if (isAptosApiError(error)) {
    const code =
      typeof error.data?.vm_error_code === "string"
        ? error.data.vm_error_code
        : typeof error.data?.error_code === "string"
          ? error.data.error_code
          : null;
    const message =
      typeof error.data?.message === "string" && error.data.message.trim()
        ? error.data.message.trim()
        : typeof error.message === "string" && error.message.trim()
          ? error.message.trim()
          : "The Aptos fullnode rejected the transaction.";

    return code
      ? `Aptos rejected the sponsored transaction (${code}): ${message}`
      : `Aptos rejected the sponsored transaction: ${message}`;
  }

  return "The PrimeGate sponsor service could not submit the transaction.";
}

export async function handleSponsorRequest(request: IncomingMessage, response: ServerResponse) {
  if ((request.method === "GET" || request.method === "HEAD") && request.url === "/health") {
    await writeHealthResponse(response, request.method === "GET");
    return;
  }

  if (request.method !== "POST" || (request.url !== "/submit" && request.url !== "/storage-account")) {
    response.setHeader("Allow", "GET, POST");
    writeJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (!isAuthorized(request)) {
    writeJson(response, 401, { error: "Unauthorized." });
    return;
  }

  try {
    if (request.url === "/storage-account") {
      const body = JSON.parse(await readRequestBody(request)) as SponsorRequestBody;
      if (typeof body.walletAddress !== "string") {
        throw new SponsorTransactionError("The publisher wallet address is required.", 400);
      }
      writeJson(response, 200, {
        storageAccount: getManagedStorageAccountAddress(body.walletAddress),
      });
      return;
    }

    const input = parseRequestBody(await readRequestBody(request));
    const pendingTransaction =
      input.operation === "shelby-registration-v2"
        ? await submitServerOwnedShelbyRegistration(input)
        : input.operation === "shelby-commit-v2"
          ? await submitServerOwnedShelbyCommit(input)
        : input.operation === "shelby-registration"
          ? await submitSponsoredShelbyTransaction(input)
          : await submitSponsoredPrimeGateListingTransaction(input);
    writeJson(response, 200, { hash: pendingTransaction.hash });
  } catch (error) {
    const status = getErrorStatus(error);

    if (status >= 500) {
      console.error("PrimeGate Shelby sponsor submission failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    writeJson(response, status, { error: getPublicErrorMessage(error) });
  }
}

export function createSponsorServer() {
  return createServer((request, response) => {
    void handleSponsorRequest(request, response);
  });
}

if (process.argv[1]?.endsWith("services/shelby-sponsor/server.ts")) {
  const port = Number(process.env.PORT ?? 10_000);
  const server = createSponsorServer();

  server.listen(port, "0.0.0.0", () => {
    console.log(`PrimeGate Shelby sponsor service listening on port ${port}.`);
  });
}
