import { listPurchases, savePurchase } from "./_lib/catalog";
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
    const purchases = await listPurchases(walletAddress);
    return Response.json({ data: purchases });
  } catch (error) {
    console.error("GET /api/purchases failed", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load purchases.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const purchase = await request.json();
    requireAuthenticatedWallet(
      request,
      purchase && typeof purchase === "object" && "walletAddress" in purchase
        ? String(purchase.walletAddress)
        : null,
    );
    const savedPurchase = await savePurchase(purchase);
    return Response.json({ data: savedPurchase });
  } catch (error) {
    console.error("POST /api/purchases failed", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to save purchase.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
