import { AuthError, requireAuthenticatedWallet } from "../../_lib/auth";
import { saveReview } from "../../_lib/catalog";

export async function POST(request: Request) {
  try {
    const segments = new URL(request.url).pathname.split("/").filter(Boolean);
    const packageId = decodeURIComponent(segments.at(-2) ?? "");

    if (!packageId) {
      return Response.json(
        {
          error: "Package id is required.",
        },
        { status: 400 },
      );
    }

    const claims = requireAuthenticatedWallet(request);
    const payload = await request.json();
    const savedReview = await saveReview({
      ...payload,
      packageId,
      walletAddress: claims.walletAddress,
    });

    return Response.json({ data: savedReview });
  } catch (error) {
    console.error("POST /api/packages/[id]/reviews failed", error);
    return Response.json(
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
