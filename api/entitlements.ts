import { listEntitlements } from "./_lib/catalog";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth";
import { jsonResponse } from "./_lib/request";

export async function GET(request: Request) {
  try {
    const walletAddress = new URL(request.url).searchParams.get("walletAddress")?.trim();

    if (!walletAddress) {
      return jsonResponse(
        {
          error: "walletAddress is required.",
        },
        { status: 400 },
      );
    }

    requireAuthenticatedWallet(request, walletAddress);
    const entitlements = await listEntitlements(walletAddress);
    return jsonResponse({ data: entitlements });
  } catch (error) {
    console.error("GET /api/entitlements failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load entitlements.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
