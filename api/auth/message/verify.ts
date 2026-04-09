import {
  AuthError,
  clearPrimeGateSignMessageCookie,
  verifyWalletMessageSession,
} from "../../_lib/auth";
import { jsonResponse } from "../../_lib/request";

type VerifyWalletMessagePayload = {
  address?: string;
  application?: string;
  bitmap?: number[];
  chainId?: number;
  fullMessage?: string;
  message?: string;
  minKeysRequired?: number;
  nonce?: string;
  prefix?: string;
  publicKey?: string | string[];
  signature?: string | string[];
  walletAddress?: string;
};

export async function POST(request: Request) {
  let body: VerifyWalletMessagePayload | null = null;

  try {
    body = (await request.json()) as VerifyWalletMessagePayload;

    console.info("POST /api/auth/message/verify request", {
      application: body.application ?? null,
      bitmapLength: body.bitmap?.length ?? null,
      chainId: body.chainId ?? null,
      hasFullMessage: Boolean(body.fullMessage),
      minKeysRequired: body.minKeysRequired ?? null,
      prefix: body.prefix ?? null,
      publicKeyCount: Array.isArray(body.publicKey) ? body.publicKey.length : body.publicKey ? 1 : 0,
      signatureCount: Array.isArray(body.signature) ? body.signature.length : body.signature ? 1 : 0,
      walletAddress: body.walletAddress ?? null,
    });

    if (
      !body.fullMessage ||
      !body.message ||
      !body.nonce ||
      !body.prefix ||
      !body.address ||
      !body.publicKey ||
      !body.signature ||
      !body.walletAddress
    ) {
      return jsonResponse(
        {
          error: "Wallet message-sign verification payload is incomplete.",
        },
        { status: 400 },
      );
    }

    const session = await verifyWalletMessageSession(request, body as Required<VerifyWalletMessagePayload>);

    console.info("POST /api/auth/message/verify success", {
      keyType: session.session.keyType,
      walletAddress: body.walletAddress,
    });

    return jsonResponse(
      { data: session },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignMessageCookie(request),
        },
      },
    );
  } catch (error) {
    const status = error instanceof AuthError ? error.status : 401;

    console.error("POST /api/auth/message/verify failed", {
      error: error instanceof Error ? error.message : "Unknown message-sign verify error",
      application: body?.application ?? null,
      bitmapLength: body?.bitmap?.length ?? null,
      chainId: body?.chainId ?? null,
      hasFullMessage: Boolean(body?.fullMessage),
      minKeysRequired: body?.minKeysRequired ?? null,
      prefix: body?.prefix ?? null,
      publicKeyCount: Array.isArray(body?.publicKey) ? body.publicKey.length : body?.publicKey ? 1 : 0,
      signatureCount: Array.isArray(body?.signature) ? body.signature.length : body?.signature ? 1 : 0,
      walletAddress: body?.walletAddress ?? null,
    });

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to verify wallet message-sign session.",
      },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignMessageCookie(request),
        },
        status,
      },
    );
  }
}
