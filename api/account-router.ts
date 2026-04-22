import {
  listEntitlements,
  listInstalls,
  listPublisherSales,
  listPurchases,
  saveInstall,
  savePurchase,
} from "./_lib/catalog.js";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

async function getEntitlements(request: Request) {
  try {
    const walletAddress = new URL(request.url).searchParams.get("walletAddress")?.trim();

    if (!walletAddress) {
      return errorResponse("walletAddress is required.", 400);
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

async function getInstalls(request: Request) {
  try {
    const walletAddress = new URL(request.url).searchParams.get("walletAddress")?.trim();

    if (!walletAddress) {
      return errorResponse("walletAddress is required.", 400);
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

async function postInstalls(request: Request) {
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

async function getPurchases(request: Request) {
  try {
    const walletAddress = new URL(request.url).searchParams.get("walletAddress")?.trim();

    if (!walletAddress) {
      return errorResponse("walletAddress is required.", 400);
    }

    requireAuthenticatedWallet(request, walletAddress);
    const purchases = await listPurchases(walletAddress);
    return jsonResponse({ data: purchases });
  } catch (error) {
    console.error("GET /api/purchases failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load purchases.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

async function postPurchases(request: Request) {
  try {
    const purchase = await request.json();
    requireAuthenticatedWallet(
      request,
      purchase && typeof purchase === "object" && "walletAddress" in purchase
        ? String(purchase.walletAddress)
        : null,
    );
    const savedPurchase = await savePurchase(purchase);
    return jsonResponse({ data: savedPurchase });
  } catch (error) {
    console.error("POST /api/purchases failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to save purchase.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

async function getSales(request: Request) {
  try {
    const ownerAddress = new URL(request.url).searchParams.get("ownerAddress")?.trim();

    if (!ownerAddress) {
      return errorResponse("ownerAddress is required.", 400);
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

export async function GET(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "entitlements":
      return getEntitlements(request);
    case "installs":
      return getInstalls(request);
    case "purchases":
      return getPurchases(request);
    case "sales":
      return getSales(request);
    default:
      return errorResponse("Account route was not found.", 404);
  }
}

export async function POST(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "installs":
      return postInstalls(request);
    case "purchases":
      return postPurchases(request);
    default:
      return methodNotAllowed(["GET"]);
  }
}
