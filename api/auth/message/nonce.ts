import {
  clearPrimeGateSignMessageCookie,
  createPrimeGateSignMessageResponse,
} from "../../_lib/auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { walletAddress?: string };
    const walletAddress = body.walletAddress?.trim();

    if (!walletAddress) {
      return Response.json(
        {
          error: "walletAddress is required.",
        },
        { status: 400 },
      );
    }

    const signMessageResponse = createPrimeGateSignMessageResponse(request, walletAddress);

    return Response.json(
      { data: signMessageResponse.payload },
      {
        headers: {
          "Set-Cookie": signMessageResponse.cookie,
        },
      },
    );
  } catch (error) {
    console.error("POST /api/auth/message/nonce failed", error);

    return Response.json(
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
