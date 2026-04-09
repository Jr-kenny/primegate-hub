import { getPackage } from "../_lib/catalog";
import { getPathParam, jsonResponse } from "../_lib/request";

export async function GET(request: Request) {
  try {
    const id = getPathParam(request);

    if (!id) {
      return jsonResponse(
        {
          error: "Package id is required.",
        },
        { status: 400 },
      );
    }

    const pkg = await getPackage(id);
    return jsonResponse(
      { data: pkg },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/packages/[id] failed", error);
    return jsonResponse(
      {
        error: "Unable to load package details.",
      },
      { status: 500 },
    );
  }
}
