import { afterEach, describe, expect, it } from "vitest";

import { getShelbyRequestOrigin } from "./shelby.js";

const originalAppOrigin = process.env.PRIMEGATE_APP_ORIGIN;
const originalProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

afterEach(() => {
  if (originalAppOrigin === undefined) {
    delete process.env.PRIMEGATE_APP_ORIGIN;
  } else {
    process.env.PRIMEGATE_APP_ORIGIN = originalAppOrigin;
  }

  if (originalProductionUrl === undefined) {
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
  } else {
    process.env.VERCEL_PROJECT_PRODUCTION_URL = originalProductionUrl;
  }
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
