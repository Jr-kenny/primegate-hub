import { listInstalls, saveInstall } from "./_lib/catalog";
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
    const installs = await listInstalls(walletAddress);
    return jsonResponse({ data: installs });
  } catch (error) {
    console.error("GET /api/installs failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load installs.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const install = await request.json();
    requireAuthenticatedWallet(
      request,
      install && typeof install === "object" && "walletAddress" in install
        ? String(install.walletAddress)
        : null,
    );
    const savedInstall = await saveInstall(install);
    return jsonResponse({ data: savedInstall });
  } catch (error) {
    console.error("POST /api/installs failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to save install.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
