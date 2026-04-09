import type {
  RegistryPackage,
  RegistryPackageResolution,
} from "./registry-data";

type PrimeGateEnvelope<T> = {
  data: T;
};

type PrimeGateClientOptions = {
  baseUrl?: string;
  fetch?: typeof fetch;
  getAuthToken?: () => string | null | undefined;
  headers?: HeadersInit;
};

type DownloadedPrimeGateArtifact = {
  arrayBuffer: ArrayBuffer;
  contentDisposition: string | null;
  contentType: string | null;
  fileName: string | null;
};

export class PrimeGateClientError extends Error {
  body: unknown;
  path: string;
  status: number;

  constructor(message: string, options: { body?: unknown; path: string; status: number }) {
    super(message);
    this.name = "PrimeGateClientError";
    this.body = options.body ?? null;
    this.path = options.path;
    this.status = options.status;
  }
}

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl ?? "").replace(/\/$/, "");
}

function resolveRequestUrl(baseUrl: string, path: string) {
  return path.startsWith("http://") || path.startsWith("https://")
    ? path
    : `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseResponseFileName(contentDisposition: string | null) {
  if (!contentDisposition) {
    return null;
  }

  const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeURIComponent(utf8Match[1]);
  }

  const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] ?? null;
}

async function parseErrorBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => null);
  }

  return response.text().catch(() => null);
}

export function createPrimeGateClient(options: PrimeGateClientOptions = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl);
  const fetchImpl = options.fetch ?? fetch;

  async function requestJson<T>(path: string, init?: RequestInit) {
    const headers = new Headers(options.headers);
    const authToken = options.getAuthToken?.();

    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    if (init?.headers) {
      const requestHeaders = new Headers(init.headers);
      requestHeaders.forEach((value, key) => headers.set(key, value));
    }

    const response = await fetchImpl(resolveRequestUrl(baseUrl, path), {
      ...init,
      headers,
    });

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      const errorMessage =
        errorBody && typeof errorBody === "object" && "error" in errorBody && errorBody.error
          ? String(errorBody.error)
          : `PrimeGate request failed with status ${response.status}.`;

      throw new PrimeGateClientError(errorMessage, {
        body: errorBody,
        path,
        status: response.status,
      });
    }

    const payload = (await response.json()) as PrimeGateEnvelope<T>;

    if (!payload || typeof payload !== "object" || !("data" in payload)) {
      throw new PrimeGateClientError("PrimeGate response was malformed.", {
        body: payload,
        path,
        status: response.status,
      });
    }

    return payload.data;
  }

  async function downloadArtifact(packageId: string): Promise<DownloadedPrimeGateArtifact> {
    const path = `/api/packages/${encodeURIComponent(packageId)}/download`;
    const headers = new Headers(options.headers);
    const authToken = options.getAuthToken?.();

    if (authToken) {
      headers.set("Authorization", `Bearer ${authToken}`);
    }

    const response = await fetchImpl(resolveRequestUrl(baseUrl, path), {
      headers,
    });

    if (!response.ok) {
      const errorBody = await parseErrorBody(response);
      const errorMessage =
        errorBody && typeof errorBody === "object" && "error" in errorBody && errorBody.error
          ? String(errorBody.error)
          : `PrimeGate request failed with status ${response.status}.`;

      throw new PrimeGateClientError(errorMessage, {
        body: errorBody,
        path,
        status: response.status,
      });
    }

    const contentDisposition = response.headers.get("content-disposition");

    return {
      arrayBuffer: await response.arrayBuffer(),
      contentDisposition,
      contentType: response.headers.get("content-type"),
      fileName: parseResponseFileName(contentDisposition),
    };
  }

  return {
    downloadArtifact,
    getPackage(packageId: string) {
      return requestJson<RegistryPackage>(`/api/packages/${encodeURIComponent(packageId)}`);
    },
    getPackageManifest(packageId: string) {
      return requestJson<Record<string, unknown>>(`/api/packages/${encodeURIComponent(packageId)}/manifest`);
    },
    resolvePackage(packageId: string) {
      return requestJson<RegistryPackageResolution>(`/api/packages/${encodeURIComponent(packageId)}/resolve`);
    },
    searchPackages(query: string) {
      return requestJson<RegistryPackage[]>(`/api/search?q=${encodeURIComponent(query)}`);
    },
  };
}

export type PrimeGateClient = ReturnType<typeof createPrimeGateClient>;
