import { ZodError } from "zod";
import { AuthError, requireAuthenticatedWallet } from "./_lib/auth";
import { createPublishIntent } from "./_lib/publishing";
import { jsonResponse } from "./_lib/request";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const claims = requireAuthenticatedWallet(request);
    const publishIntent = createPublishIntent(claims.walletAddress, payload);
    return jsonResponse({ data: publishIntent });
  } catch (error) {
    console.error("POST /api/publish-intent failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to create publish intent.",
      },
      {
        status:
          error instanceof AuthError
            ? error.status
            : error instanceof SyntaxError || error instanceof ZodError
              ? 400
              : 500,
      },
    );
  }
}
