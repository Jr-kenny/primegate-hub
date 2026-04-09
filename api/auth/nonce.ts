import { clearPrimeGateSignInCookie, createPrimeGateSignInResponse } from "../_lib/auth";

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

    const signInResponse = createPrimeGateSignInResponse(request, walletAddress);

    return Response.json(
      { data: signInResponse.payload },
      {
        headers: {
          "Set-Cookie": signInResponse.cookie,
        },
      },
    );
  } catch (error) {
    console.error("POST /api/auth/nonce failed", error);

    return Response.json(
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
