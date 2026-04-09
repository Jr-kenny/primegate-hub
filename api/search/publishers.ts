import { searchCatalogPublishers } from "../_lib/catalog";
import { jsonResponse } from "../_lib/request";

export async function GET(request: Request) {
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
    return jsonResponse(
      {
        error: "Unable to search PrimeGate publishers.",
      },
      { status: 500 },
    );
  }
}
