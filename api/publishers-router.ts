import { getPublisherProfile } from "./_lib/catalog.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

function getPublisherId(request: Request) {
  return new URL(request.url).searchParams.get("id")?.trim() ?? "";
}

export async function GET(request: Request) {
  try {
    const id = getPublisherId(request);

    if (!id) {
      return errorResponse("Publisher id is required.", 400);
    }

    const publisherProfile = await getPublisherProfile(id);
    return jsonResponse(
      { data: publisherProfile },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/publishers/[id] failed", error);
    return errorResponse("Unable to load publisher profile.", 500);
  }
}

export function POST() {
  return methodNotAllowed(["GET"]);
}
