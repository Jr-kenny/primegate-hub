import { ZodError } from "zod";
import { listPublishedAssets } from "./_lib/catalog";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth";
import { finalizePublishedAsset } from "./_lib/publishing";
import { jsonResponse } from "./_lib/request";

export async function GET(request: Request) {
  try {
    const ownerAddress = new URL(request.url).searchParams.get("ownerAddress")?.trim();

    if (!ownerAddress) {
      return jsonResponse(
        {
          error: "ownerAddress is required.",
        },
        { status: 400 },
      );
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

export async function POST(request: Request) {
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
