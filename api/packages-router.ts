import { getPackage, listPackages, saveReview } from "./_lib/catalog.js";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth.js";
import {
  downloadPublishedPackageArtifact,
  getPackageResolution,
  getPublishedPackageManifest,
} from "./_lib/package-resolution.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

function getPackageId(request: Request) {
  return new URL(request.url).searchParams.get("id")?.trim() ?? "";
}

function buildContentDisposition(fileName: string) {
  const encodedFileName = encodeURIComponent(fileName).replace(/['()]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${fileName.replace(/"/g, "")}"; filename*=UTF-8''${encodedFileName}`;
}

async function getPackages() {
  try {
    const packages = await listPackages();
    return jsonResponse(
      { data: packages },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/packages failed", error);
    return errorResponse("Unable to load packages.", 500);
  }
}

async function getPackageDetail(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return errorResponse("Package id is required.", 400);
    }

    const pkg = await getPackage(id);
    return jsonResponse(
      { data: pkg },
      undefined,
      "public, max-age=30, stale-while-revalidate=300",
    );
  } catch (error) {
    console.error("GET /api/packages/[id] failed", error);
    return errorResponse("Unable to load package details.", 500);
  }
}

async function getPackageDownload(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return errorResponse("Package id is required.", 400);
    }

    const artifact = await downloadPublishedPackageArtifact(request, id);

    if (!artifact) {
      return errorResponse("This package does not expose a downloadable published artifact.", 404);
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

async function getPackageManifest(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return errorResponse("Package id is required.", 400);
    }

    const manifest = await getPublishedPackageManifest(request, id);

    if (!manifest) {
      return errorResponse("This package does not expose a downloadable published manifest.", 404);
    }

    return jsonResponse({ data: manifest });
  } catch (error) {
    console.error("GET /api/packages/[id]/manifest failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to load package manifest.",
      },
      { status: error instanceof AuthError ? error.status : 500 },
    );
  }
}

async function getPackageResolve(request: Request) {
  try {
    const id = getPackageId(request);

    if (!id) {
      return errorResponse("Package id is required.", 400);
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

async function postPackageReview(request: Request) {
  try {
    const packageId = getPackageId(request);

    if (!packageId) {
      return errorResponse("Package id is required.", 400);
    }

    const claims = requireAuthenticatedWallet(request);
    const payload = await request.json();
    const savedReview = await saveReview({
      ...payload,
      packageId,
      walletAddress: claims.walletAddress,
    });

    return jsonResponse({ data: savedReview });
  } catch (error) {
    console.error("POST /api/packages/[id]/reviews failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to save package review.",
      },
      {
        status:
          error instanceof AuthError
            ? error.status
            : error instanceof SyntaxError
              ? 400
              : 500,
      },
    );
  }
}

export async function GET(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "index":
      return getPackages();
    case "detail":
      return getPackageDetail(request);
    case "download":
      return getPackageDownload(request);
    case "manifest":
      return getPackageManifest(request);
    case "resolve":
      return getPackageResolve(request);
    default:
      return errorResponse("Package route was not found.", 404);
  }
}

export async function POST(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "reviews":
      return postPackageReview(request);
    default:
      return methodNotAllowed(["GET"]);
  }
}
