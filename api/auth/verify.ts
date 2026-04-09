import {
  AuthError,
  clearPrimeGateSignInCookie,
  verifyWalletSession,
} from "../_lib/auth";
import { jsonResponse } from "../_lib/request";
import type { SerializedAptosSignInOutput } from "@aptos-labs/siwa";

export async function POST(request: Request) {
  let body: { output?: SerializedAptosSignInOutput } | null = null;

  try {
    body = (await request.json()) as { output?: SerializedAptosSignInOutput };

    console.info("POST /api/auth/verify request", {
      outputType: body.output?.type ?? null,
      outputVersion: body.output?.version ?? null,
      publicKeyLength: body.output?.publicKey?.length ?? null,
      walletAddress: body.output?.input?.address ?? null,
    });

    if (!body.output) {
      return jsonResponse(
        {
          error: "Wallet verification payload is incomplete.",
        },
        { status: 400 },
      );
    }

    const session = await verifyWalletSession(request, body.output);

    console.info("POST /api/auth/verify success", {
      outputType: body.output.type,
      walletAddress: body.output.input.address,
    });

    return jsonResponse(
      { data: session },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignInCookie(request),
        },
      },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401;

    console.error("POST /api/auth/verify failed", {
      error: error instanceof Error ? error.message : "Unknown auth verify error",
      outputType: body?.output?.type ?? null,
      outputVersion: body?.output?.version ?? null,
      publicKeyLength: body?.output?.publicKey?.length ?? null,
      walletAddress: body?.output?.input?.address ?? null,
    });

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to verify wallet session.",
      },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignInCookie(request),
        },
        status,
      },
    );
  }
}
