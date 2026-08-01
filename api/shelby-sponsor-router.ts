import { AccountAddress } from "@aptos-labs/ts-sdk";

import { AuthError, requireAuthenticatedWallet } from "./_lib/auth.js";
import { getPublishedAssetById } from "./_lib/catalog.js";
import { verifyPublishAttestationToken } from "./_lib/publishing.js";
import { errorResponse, jsonResponse, methodNotAllowed } from "./_lib/request.js";
import { normalizeAptAmount, parseAptAmountToOctas } from "../src/lib/aptos-amount.js";
import { readPrimeGateEnvValue } from "../src/lib/primegate-env.js";

type SponsorSubmitBody = {
  senderAuthenticatorHex?: unknown;
  transactionHex?: unknown;
  walletAddress?: unknown;
  attestationToken?: unknown;
  expectedPackageId?: unknown;
  expectedPriceOctas?: unknown;
  operation?: unknown;
};

function getSponsorServiceUrl() {
  return readPrimeGateEnvValue(process.env.PRIMEGATE_SPONSOR_SERVICE_URL).replace(/\/$/, "");
}

function getSponsorServiceToken() {
  return readPrimeGateEnvValue(process.env.PRIMEGATE_SPONSOR_SERVICE_TOKEN);
}

function getConfiguredSponsorAddress() {
  const value = readPrimeGateEnvValue(process.env.PRIMEGATE_SHELBY_SPONSOR_ADDRESS);

  if (!value) {
    return null;
  }

  try {
    return AccountAddress.from(value).toStringLong();
  } catch {
    throw new Error("PRIMEGATE_SHELBY_SPONSOR_ADDRESS is invalid.");
  }
}

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assertHexSize(value: string, field: string, maxLength: number) {
  if (!/^0x[0-9a-f]+$/i.test(value) || (value.length - 2) % 2 !== 0) {
    throw new AuthError(`${field} must be a valid hexadecimal value.`, 400);
  }

  if (value.length > maxLength) {
    throw new AuthError(`${field} is too large.`, 400);
  }
}

async function getSponsorConfig(request: Request) {
  requireAuthenticatedWallet(request);

  const sponsorAddress = getConfiguredSponsorAddress();
  const configured = Boolean(sponsorAddress && getSponsorServiceUrl() && getSponsorServiceToken());

  return jsonResponse(
    {
      data: {
        enabled: configured,
        sponsorAddress: configured ? sponsorAddress : null,
      },
    },
    undefined,
    "private, no-store",
  );
}

async function submitSponsoredTransaction(request: Request) {
  try {
    const body = (await request.json()) as SponsorSubmitBody;

    if (
      !isString(body.walletAddress) ||
      !isString(body.transactionHex) ||
      !isString(body.senderAuthenticatorHex) ||
      (body.operation !== "shelby-registration" && body.operation !== "primegate-listing")
    ) {
      return errorResponse("The sponsor transaction request was incomplete.", 400);
    }

    const authenticated = requireAuthenticatedWallet(request, body.walletAddress);

    assertHexSize(body.transactionHex, "transactionHex", 2 + 64 * 1024 * 2);
    assertHexSize(body.senderAuthenticatorHex, "senderAuthenticatorHex", 2 + 8 * 1024 * 2);

    const serviceUrl = getSponsorServiceUrl();
    const serviceToken = getSponsorServiceToken();
    const sponsorAddress = getConfiguredSponsorAddress();

    if (!serviceUrl || !serviceToken || !sponsorAddress) {
      return errorResponse("The Shelby sponsor service is not configured.", 503);
    }

    let serviceBody: Record<string, unknown>;

    if (body.operation === "shelby-registration") {
      if (!isString(body.attestationToken)) {
        return errorResponse("The Shelby sponsor request is missing its publish attestation.", 400);
      }

      const claims = verifyPublishAttestationToken(body.attestationToken);

      if (claims.ownerAddress !== authenticated.walletAddress) {
        throw new AuthError("The publish attestation does not match the authenticated wallet.", 401);
      }

      serviceBody = {
        expectedBlobNames: [claims.assetBlobName, claims.manifestBlobName],
        operation: "shelby-registration",
        senderAuthenticatorHex: body.senderAuthenticatorHex,
        transactionHex: body.transactionHex,
        walletAddress: authenticated.walletAddress,
      };
    } else {
      if (!isString(body.expectedPackageId) || !/^\d+$/.test(String(body.expectedPriceOctas ?? ""))) {
        return errorResponse("The PrimeGate listing sponsor request was incomplete.", 400);
      }

      const expectedPackageId = body.expectedPackageId.trim();
      const expectedPriceOctas = String(body.expectedPriceOctas);
      const publishedAsset = await getPublishedAssetById(expectedPackageId);

      if (!publishedAsset) {
        return errorResponse("The PrimeGate release was not found.", 404);
      }

      if (publishedAsset.ownerAddress.toLowerCase() !== authenticated.walletAddress.toLowerCase()) {
        throw new AuthError("The PrimeGate release does not belong to the authenticated wallet.", 403);
      }

      const storedPrice = normalizeAptAmount(publishedAsset.price);
      if (storedPrice === "0") {
        return errorResponse("Free PrimeGate releases do not need a paid listing transaction.", 400);
      }

      const storedPriceOctas = parseAptAmountToOctas(storedPrice).toString();
      if (storedPriceOctas !== expectedPriceOctas) {
        return errorResponse("The PrimeGate listing price does not match the stored release.", 400);
      }

      serviceBody = {
        expectedPackageId,
        expectedPriceOctas,
        operation: "primegate-listing",
        senderAuthenticatorHex: body.senderAuthenticatorHex,
        transactionHex: body.transactionHex,
        walletAddress: authenticated.walletAddress,
      };
    }

    const response = await fetch(`${serviceUrl}/submit`, {
      body: JSON.stringify(serviceBody),
      headers: {
        "Content-Type": "application/json",
        "X-PrimeGate-Sponsor-Token": serviceToken,
      },
      method: "POST",
      signal: AbortSignal.timeout(15_000),
    });

    const servicePayload = (await response.json().catch(() => null)) as
      | { error?: string; hash?: string }
      | null;

    if (!response.ok || !servicePayload?.hash) {
      console.error("PrimeGate Shelby sponsor service rejected a transaction", {
        status: response.status,
        serviceError: servicePayload?.error ?? null,
        walletAddress: authenticated.walletAddress,
      });
      return errorResponse(servicePayload?.error ?? "The Shelby sponsor service rejected the transaction.", 502);
    }

    return jsonResponse({ data: { hash: servicePayload.hash } }, undefined, "private, no-store");
  } catch (error) {
    console.error("POST /api/shelby-sponsor failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to submit the sponsored Shelby transaction.",
      },
      {
        status:
          error instanceof AuthError
            ? error.status
            : error instanceof SyntaxError
              ? 400
              : 502,
      },
    );
  }
}

export async function GET(request: Request) {
  if (getRoute(request) !== "config") {
    return errorResponse("Shelby sponsor route was not found.", 404);
  }

  try {
    return await getSponsorConfig(request);
  } catch (error) {
    console.error("GET /api/shelby-sponsor/config failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load Shelby sponsor configuration.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

export async function POST(request: Request) {
  if (getRoute(request) !== "submit") {
    return methodNotAllowed(["GET"]);
  }

  return submitSponsoredTransaction(request);
}
