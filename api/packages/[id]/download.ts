import { AuthError } from "../../_lib/auth";
import { downloadPublishedPackageArtifact } from "../../_lib/package-resolution";
import { jsonResponse } from "../../_lib/request";

function getPackageId(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  return decodeURIComponent(segments.at(-2) ?? "");
}

function buildContentDisposition(fileName: string) {
  const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodedFileName}`;
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

    const artifact = await downloadPublishedPackageArtifact(request, id);

    if (!artifact) {
      return jsonResponse(
        {
          error: "This package does not expose a downloadable published artifact.",
        },
        { status: 404 },
      );
    }

    return new Response(artifact.bytes, {
      headers: {
        "Cache-Control": "public, max-age=60",
        "Content-Disposition": buildContentDisposition(artifact.originalFileName),
        "Content-Length": String(artifact.bytes.byteLength),
        "Content-Type": artifact.mimeType || "application/octet-stream",
      },
      status: 200,
    });
  } catch (error) {
    console.error("GET /api/packages/[id]/download failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to download package artifact.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}
