import { ZodError } from "zod";

import { listPublishedAssets } from "./_lib/catalog.js";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth.js";
import { createPublishIntent, finalizePublishedAsset } from "./_lib/publishing.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

async function postPublishIntent(request: Request) {
  try {
    const payload = await request.json();
    const claims = requireAuthenticatedWallet(request);
    const publishIntent = createPublishIntent(claims.walletAddress, payload);
    return jsonResponse({ data: publishIntent });
  } catch (error) {
    console.error("POST /api/publish-intent failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to create publish intent.",
      },
      {
        status:
          error instanceof AuthError
            ? error.status
            : error instanceof SyntaxError || error instanceof ZodError
              ? 400
              : 500,
      },
    );
  }
}

async function getPublishedAssets(request: Request) {
  try {
    const ownerAddress = new URL(request.url).searchParams.get("ownerAddress")?.trim();

    if (!ownerAddress) {
      return errorResponse("ownerAddress is required.", 400);
    }

    requireAuthenticatedWallet(request, ownerAddress);
    const assets = await listPublishedAssets(ownerAddress);
    return jsonResponse({ data: assets });
  } catch (error) {
    console.error("GET /api/published-assets failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load published assets.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

async function postPublishedAssets(request: Request) {
  try {
    const payload = await request.json();
    const claims = requireAuthenticatedWallet(request);
    const savedAsset = await finalizePublishedAsset(claims.walletAddress, payload);
    return jsonResponse({ data: savedAsset });
  } catch (error) {
    console.error("POST /api/published-assets failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to save published asset metadata.",
      },
      {
        status:
          error instanceof AuthError
            ? error.status
            : error instanceof SyntaxError || error instanceof ZodError
              ? 400
              : 500,
      },
    );
  }
}

export async function GET(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "published-assets":
      return getPublishedAssets(request);
    default:
      return errorResponse("Publishing route was not found.", 404);
  }
}

export async function POST(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "publish-intent":
      return postPublishIntent(request);
    case "published-assets":
      return postPublishedAssets(request);
    default:
      return methodNotAllowed(["GET"]);
  }
}
