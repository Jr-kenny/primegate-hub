import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadShelbyBlob, getShelbyRequestOrigin } from "./shelby.js";

const originalAppOrigin = process.env.PRIMEGATE_APP_ORIGIN;
const originalProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const originalApiKey = process.env.SHELBY_API_KEY;
const originalRpcBaseUrl = process.env.SHELBY_RPC_BASE_URL;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

afterEach(() => {
  restoreEnv("PRIMEGATE_APP_ORIGIN", originalAppOrigin);
  restoreEnv("VERCEL_PROJECT_PRODUCTION_URL", originalProductionUrl);
  restoreEnv("SHELBY_API_KEY", originalApiKey);
  restoreEnv("SHELBY_RPC_BASE_URL", originalRpcBaseUrl);
  vi.unstubAllGlobals();
});

describe("getShelbyRequestOrigin", () => {
  it("uses the configured public origin", () => {
    process.env.PRIMEGATE_APP_ORIGIN = "https://registry.example";

    expect(getShelbyRequestOrigin()).toBe("https://registry.example");
  });

  it("normalizes Vercel's hostname to an HTTPS origin", () => {
    delete process.env.PRIMEGATE_APP_ORIGIN;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "registry.example";

    expect(getShelbyRequestOrigin()).toBe("https://registry.example");
  });
});

describe("downloadShelbyBlob", () => {
  it("sends the public origin, API key, and byte range", async () => {
    process.env.PRIMEGATE_APP_ORIGIN = "https://registry.example";
    process.env.SHELBY_API_KEY = "test-key";
    process.env.SHELBY_RPC_BASE_URL = "https://rpc.example/shelby";
    const fetchMock = vi.fn().mockResolvedValue({
      body: {},
      ok: true,
      status: 206,
      statusText: "Partial Content",
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadShelbyBlob({
      account: "0x123",
      blobName: "folder/file name.bin",
      range: { end: 19, start: 10 },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("https://rpc.example/shelby/v1/blobs/0x123/folder/file%20name.bin");
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers.Origin).toBe("https://registry.example");
    expect(headers.Range).toBe("bytes=10-19");
  });
});
