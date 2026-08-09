import type { SerializedAptosSignInOutput } from "@aptos-labs/siwa";

import {
  AuthError,
  clearPrimeGateSessionCookie,
  clearPrimeGateSignInCookie,
  clearPrimeGateSignMessageCookie,
  createPrimeGateSessionCookie,
  createPrimeGateSignInResponse,
  createPrimeGateSignMessageResponse,
  verifyWalletMessageSession,
  verifyWalletSession,
} from "./_lib/auth.js";
import { jsonResponse, errorResponse, methodNotAllowed } from "./_lib/request.js";

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

function getRoute(request: Request) {
  return new URL(request.url).searchParams.get("route")?.trim() ?? "";
}

async function postLogout(request: Request) {
  return jsonResponse(
    { data: true },
    {
      headers: {
        "Set-Cookie": clearPrimeGateSessionCookie(request),
      },
    },
  );
}

async function postNonce(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return errorResponse("walletAddress is required.", 400);
    }

    const signInResponse = createPrimeGateSignInResponse(request, walletAddress);
    return jsonResponse(
      { data: signInResponse.payload },
      {
        headers: {
          "Set-Cookie": signInResponse.cookie,
        },
      },
    );
  } catch (error) {
    console.error("POST /api/auth/nonce failed", error);
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to issue PrimeGate sign-in input.",
      },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignInCookie(request),
        },
        status: 500,
      },
    );
  }
}

async function postVerify(request: Request) {
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
      return errorResponse("Wallet verification payload is incomplete.", 400);
    }

    const session = await verifyWalletSession(request, body.output);

    console.info("POST /api/auth/verify success", {
      outputType: body.output.type,
      walletAddress: body.output.input.address,
    });

    return jsonResponse(
      { data: session },
      {
        headers: buildSessionHeaders(request, session.session.token, clearPrimeGateSignInCookie(request)),
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

async function postMessageNonce(request: Request) {
  try {
    const body = (await request.json()) as { chainId?: number; walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return errorResponse("walletAddress is required.", 400);
    }

    const signMessageResponse = await createPrimeGateSignMessageResponse(
      request,
      walletAddress,
      body.chainId,
    );
    return jsonResponse(
      { data: signMessageResponse.payload },
      {
        headers: {
          "Set-Cookie": signMessageResponse.cookie,
        },
      },
    );
  } catch (error) {
    console.error("POST /api/auth/message/nonce failed", error);
    const status = error instanceof AuthError ? error.status : 500;
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Unable to issue PrimeGate message-sign challenge.",
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

async function postMessageVerify(request: Request) {
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
      return errorResponse("Wallet message-sign verification payload is incomplete.", 400);
    }

    const session = await verifyWalletMessageSession(request, body as Required<VerifyWalletMessagePayload>);

    console.info("POST /api/auth/message/verify success", {
      keyType: session.session.keyType,
      walletAddress: body.walletAddress,
    });

    return jsonResponse(
      { data: session },
      {
        headers: buildSessionHeaders(request, session.session.token, clearPrimeGateSignMessageCookie(request)),
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

function buildSessionHeaders(request: Request, token: string, challengeCookie: string) {
  const headers = new Headers();
  headers.append("Set-Cookie", createPrimeGateSessionCookie(request, token));
  headers.append("Set-Cookie", challengeCookie);
  return headers;
}

export async function POST(request: Request) {
  const route = getRoute(request);

  switch (route) {
    case "logout":
      return postLogout(request);
    case "nonce":
      return postNonce(request);
    case "verify":
      return postVerify(request);
    case "message-nonce":
      return postMessageNonce(request);
    case "message-verify":
      return postMessageVerify(request);
    default:
      return errorResponse("Auth route was not found.", 404);
  }
}

export function GET() {
  return methodNotAllowed(["POST"]);
}
