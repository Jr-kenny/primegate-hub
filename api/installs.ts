import { listInstalls, saveInstall } from "./_lib/catalog";
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
    const installs = await listInstalls(walletAddress);
    return Response.json({ data: installs });
  } catch (error) {
    console.error("GET /api/installs failed", error);
    return Response.json(
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
    return Response.json({ data: savedInstall });
  } catch (error) {
    console.error("POST /api/installs failed", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to save install.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
