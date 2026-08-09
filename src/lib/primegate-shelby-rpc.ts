const PRIMEGATE_SHELBY_RPC_PREFLIGHT_TIMEOUT_MS = 5_000;

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message.trim() ? error.message.trim() : "Network request failed.";
}

export async function assertPrimeGateShelbyRpcReachable(
  baseUrl: string,
  apiKey: string | undefined,
  fetchImplementation: typeof fetch = fetch,
) {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/v1/multipart-uploads`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PRIMEGATE_SHELBY_RPC_PREFLIGHT_TIMEOUT_MS);

  try {
    const response = await fetchImplementation(endpoint, {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      signal: controller.signal,
    });

    if (response.status >= 500) {
      throw new Error(`Shelby RPC returned HTTP ${response.status}.`);
    }
  } catch (error) {
    const message = error instanceof DOMException && error.name === "AbortError"
      ? "The request timed out."
      : getErrorMessage(error);

    throw new Error(`The configured Shelby RPC endpoint is unreachable at ${baseUrl}. ${message}`);
  } finally {
    clearTimeout(timeoutId);
  }
}
