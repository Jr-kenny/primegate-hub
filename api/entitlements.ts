import { listEntitlements } from "./_lib/catalog";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth";

export async function GET(request: Request) {
  try {
    const walletAddress = new URL(request.url).searchParams.get("walletAddress")?.trim();

    if (!walletAddress) {
      return Response.json(
        {
          error: "walletAddress is required.",
        },
        { status: 400 },
      );
    }

    requireAuthenticatedWallet(request, walletAddress);
    const entitlements = await listEntitlements(walletAddress);
    return Response.json({ data: entitlements });
  } catch (error) {
    console.error("GET /api/entitlements failed", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load entitlements.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
