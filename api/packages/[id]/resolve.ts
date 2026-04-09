import { AuthError } from "../../_lib/auth";
import { getPackageResolution } from "../../_lib/package-resolution";
import { jsonResponse } from "../../_lib/request";

function getPackageId(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-2) ?? "");
}

export async function GET(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return jsonResponse(
        {
          error: "Package id is required.",
        },
        { status: 400 },
      );
    }

    const resolution = await getPackageResolution(request, id);
    return jsonResponse({ data: resolution });
  } catch (error) {
    console.error("GET /api/packages/[id]/resolve failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to resolve package.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
