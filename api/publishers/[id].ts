import { getPublisherProfile } from "../_lib/catalog";
import { getPathParam, jsonResponse } from "../_lib/request";

export async function GET(request: Request) {
  try {
    const id = getPathParam(request);

    if (!id) {
      return jsonResponse(
        {
          error: "Publisher id is required.",
        },
        { status: 400 },
      );
    }

    const publisherProfile = await getPublisherProfile(id);
    return jsonResponse(
      { data: publisherProfile },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/publishers/[id] failed", error);
    return jsonResponse(
      {
        error: "Unable to load publisher profile.",
      },
      { status: 500 },
    );
  }
}
