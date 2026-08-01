import { timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  SponsorConfigurationError,
  SponsorTransactionError,
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

  if (
    typeof body.operation !== "string" ||
    typeof body.walletAddress !== "string" ||
    typeof body.transactionHex !== "string" ||
    typeof body.senderAuthenticatorHex !== "string"
  ) {
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

function getErrorStatus(error: unknown) {
  if (error instanceof SponsorTransactionError || error instanceof SponsorConfigurationError) {
    return error.status;
  }

  return 500;
}

function getPublicErrorMessage(error: unknown) {
  if (error instanceof SponsorTransactionError || error instanceof SponsorConfigurationError) {
    return error.message;
  }

  return "The PrimeGate sponsor service could not submit the transaction.";
}

export async function handleSponsorRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET" && request.url === "/health") {
    writeJson(response, 200, {
      sponsorConfigured: Boolean(process.env.PRIMEGATE_SHELBY_SPONSOR_PRIVATE_KEY?.trim()),
      status: "ok",
    });
    return;
  }

  if (request.method !== "POST" || request.url !== "/submit") {
    response.setHeader("Allow", "GET, POST");
    writeJson(response, 405, { error: "Method not allowed." });
    return;
  }

  if (!isAuthorized(request)) {
    writeJson(response, 401, { error: "Unauthorized." });
    return;
  }

  try {
    const input = parseRequestBody(await readRequestBody(request));
    const pendingTransaction =
      input.operation === "shelby-registration"
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
