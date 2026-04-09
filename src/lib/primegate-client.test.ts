import { describe, expect, it, vi } from "vitest";

import { PrimeGateClientError, createPrimeGateClient } from "@/lib/primegate-client";

describe("createPrimeGateClient", () => {
  it("searches packages against the configured PrimeGate base URL", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "pkg-1", name: "@scope/pkg-1" }],
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      ),
    );

    const client = createPrimeGateClient({
      baseUrl: "https://primegate.local/",
      fetch: fetchMock,
    });

    const results = await client.searchPackages("agent ready");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://primegate.local/api/search?q=agent%20ready",
      expect.objectContaining({ headers: expect.any(Headers) }),
    );
    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe("pkg-1");
  });

  it("forwards bearer auth when resolving a package", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer session-token");

      return new Response(
        JSON.stringify({
          data: {
            access: "public",
            artifact: null,
            downloadPath: null,
            downloadUrl: null,
            install: {
              cli: "primegate install @scope/pkg-1",
              mcp: "mcp://primegate.io/packages/pkg-1",
              sdk: 'await primegate.install("@scope/pkg-1")',
              web: "/package/pkg-1",
            },
            manifestPath: null,
            manifestUrl: null,
            packageId: "pkg-1",
            packageName: "@scope/pkg-1",
            payment: null,
            price: "Free",
            resolvePath: "/api/packages/pkg-1/resolve",
            resolveUrl: "https://primegate.local/api/packages/pkg-1/resolve",
            version: "1.0.0",
          },
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
          status: 200,
        },
      );
    });

    const client = createPrimeGateClient({
      baseUrl: "https://primegate.local",
      fetch: fetchMock,
      getAuthToken: () => "session-token",
    });

    const resolution = await client.resolvePackage("pkg-1");

    expect(resolution.resolveUrl).toBe("https://primegate.local/api/packages/pkg-1/resolve");
  });

  it("downloads artifacts and parses the response filename", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("artifact-bytes", {
        headers: {
          "Content-Disposition": "attachment; filename*=UTF-8''artifact.txt",
          "Content-Type": "text/plain",
        },
        status: 200,
      }),
    );

    const client = createPrimeGateClient({
      baseUrl: "https://primegate.local",
      fetch: fetchMock,
    });

    const download = await client.downloadArtifact("pkg-1");
    const bytes = new Uint8Array(download.arrayBuffer);

    expect(download.fileName).toBe("artifact.txt");
    expect(download.contentType).toBe("text/plain");
    expect(new TextDecoder().decode(bytes)).toBe("artifact-bytes");
  });

  it("throws PrimeGateClientError on API failures", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: "No package matched." }), {
        headers: {
          "Content-Type": "application/json",
        },
        status: 404,
      }),
    );

    const client = createPrimeGateClient({
      baseUrl: "https://primegate.local",
      fetch: fetchMock,
    });

    await expect(client.getPackage("missing")).rejects.toMatchObject<PrimeGateClientError>({
      message: "No package matched.",
      path: "/api/packages/missing",
      status: 404,
    });
  });
});
