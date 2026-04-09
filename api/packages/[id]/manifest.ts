import { AuthError } from "../../_lib/auth";
import { getPublishedPackageManifest } from "../../_lib/package-resolution";

function getPackageId(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-2) ?? "");
}

export async function GET(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return Response.json(
        {
          error: "Package id is required.",
        },
        { status: 400 },
      );
    }

    const manifest = await getPublishedPackageManifest(request, id);

    if (!manifest) {
      return Response.json(
        {
          error: "This package does not expose a downloadable published manifest.",
        },
        { status: 404 },
      );
    }

    return Response.json({ data: manifest });
  } catch (error) {
    console.error("GET /api/packages/[id]/manifest failed", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to load package manifest.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
