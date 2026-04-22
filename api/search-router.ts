import { searchCatalogPackages, searchCatalogPublishers } from "./_lib/catalog.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

async function getPackageSearch(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return jsonResponse({ data: [] }, undefined, "public, max-age=10, stale-while-revalidate=60");
    }

    const results = await searchCatalogPackages(query);
    return jsonResponse(
      { data: results },
      undefined,
      "public, max-age=15, stale-while-revalidate=60",
    );
  } catch (error) {
    console.error("GET /api/search failed", error);
    return errorResponse("Unable to search the PrimeGate catalog.", 500);
  }
}

async function getPublisherSearch(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

    if (!query) {
      return jsonResponse({ data: [] }, undefined, "public, max-age=10, stale-while-revalidate=60");
    }

    const results = await searchCatalogPublishers(query);
    return jsonResponse(
      { data: results },
      undefined,
      "public, max-age=15, stale-while-revalidate=60",
    );
  } catch (error) {
    console.error("GET /api/search/publishers failed", error);
    return errorResponse("Unable to search PrimeGate publishers.", 500);
  }
}

export async function GET(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "packages":
      return getPackageSearch(request);
    case "publishers":
      return getPublisherSearch(request);
    default:
      return errorResponse("Search route was not found.", 404);
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}
