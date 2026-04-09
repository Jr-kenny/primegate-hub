import { listPublisherSales } from "./_lib/catalog";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth";
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
    const sales = await listPublisherSales(ownerAddress);
    return jsonResponse({ data: sales });
  } catch (error) {
    console.error("GET /api/sales failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load publisher sales.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
