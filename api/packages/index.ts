import { listPackages } from "../_lib/catalog";
import { jsonResponse } from "../_lib/request";

export async function GET() {
  try {
    const packages = await listPackages();
    return jsonResponse(
      { data: packages },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/packages failed", error);
    return jsonResponse(
      {
        error: "Unable to load packages.",
      },
      { status: 500 },
    );
  }
}
