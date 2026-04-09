import {
  clearPrimeGateSignMessageCookie,
  createPrimeGateSignMessageResponse,
} from "../../_lib/auth";
import { jsonResponse } from "../../_lib/request";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return jsonResponse(
        {
          error: "walletAddress is required.",
        },
        { status: 400 },
      );
    }

    const signMessageResponse = createPrimeGateSignMessageResponse(request, walletAddress);

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

    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Unable to issue PrimeGate message-sign challenge.",
      },
      {
        headers: {
          "Set-Cookie": clearPrimeGateSignMessageCookie(request),
        },
        status: 500,
      },
    );
  }
}
