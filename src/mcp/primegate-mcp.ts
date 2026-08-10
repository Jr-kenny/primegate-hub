#!/usr/bin/env node

import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import * as z from "zod/v4";

const DEFAULT_BASE_URL = "https://primegatelive.vercel.app";
const MAX_CLI_OUTPUT_BYTES = 2 * 1024 * 1024;
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const cliExecutable = path.join(repositoryRoot, "node_modules", ".bin", "tsx");
const cliEntryPoint = path.join(repositoryRoot, "src", "cli", "primegate.ts");

type CliResult = {
  data: unknown;
  stderr: string;
  stdout: string;
};

function normalizeBaseUrl(baseUrl?: string) {
  return (baseUrl ?? process.env.PRIMEGATE_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/$/, "");
}

function parseCliJson(stdout: string) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const lines = trimmed.split("\n");
    const jsonStart = lines.findIndex((line) => line.startsWith("{") || line.startsWith("["));
    if (jsonStart === -1) {
      return null;
    }

    return JSON.parse(lines.slice(jsonStart).join("\n")) as unknown;
  }
}

export function runPrimeGateCli(args: string[]): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cliExecutable, [cliEntryPoint, ...args], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    const appendOutput = (current: string, chunk: Buffer) => {
      const next = current + chunk.toString("utf8");
      if (Buffer.byteLength(next, "utf8") > MAX_CLI_OUTPUT_BYTES) {
        child.kill();
        reject(new Error("PrimeGate CLI output exceeded the MCP safety limit."));
        return current;
      }
      return next;
    };

    child.stdout.on("data", (chunk: Buffer) => {
      stdout = appendOutput(stdout, chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = appendOutput(stderr, chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `PrimeGate CLI exited with code ${code}.`));
        return;
      }

      try {
        resolve({ data: parseCliJson(stdout), stderr: stderr.trim(), stdout: stdout.trim() });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function toolSuccess(result: CliResult) {
  const value = result.data ?? result.stdout;
  const structuredContent =
    result.data && typeof result.data === "object"
      ? Array.isArray(result.data)
        ? { results: result.data }
        : (result.data as Record<string, unknown>)
      : undefined;
  return {
    content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
    ...(structuredContent ? { structuredContent } : {}),
  };
}

function toolFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "PrimeGate operation failed.";
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

function withBaseUrl(args: string[], baseUrl?: string) {
  return [...args, "--base-url", normalizeBaseUrl(baseUrl), "--json"];
}

const baseUrlSchema = z.string().url().optional().describe(`PrimeGate API URL. Defaults to ${DEFAULT_BASE_URL}.`);
const packageIdSchema = z.string().uuid().describe("PrimeGate release package ID.");

export function buildPrimeGateMcpServer() {
  const server = new McpServer(
    { name: "primegate", version: "1.0.0" },
    {
      capabilities: { resources: {}, tools: {} },
      instructions:
        "Use PrimeGate to search, resolve, verify, install, and publish versioned packages. Publishing performs real external writes and wallet signatures. Call it only when the user explicitly asks to publish. Never expose wallet private keys or wallet file contents.",
    },
  );

  server.registerTool(
    "primegate_search_packages",
    {
      title: "Search PrimeGate packages",
      description: "Search the public PrimeGate catalog for packages that match a query.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Package name, keyword, publisher, or description to search for."),
        baseUrl: baseUrlSchema,
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ query, baseUrl }) => {
      try {
        return toolSuccess(await runPrimeGateCli(withBaseUrl(["search", query], baseUrl)));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "primegate_resolve_package",
    {
      title: "Resolve a PrimeGate package",
      description: "Resolve package metadata, access state, manifest, download, CLI, SDK, and MCP install paths.",
      inputSchema: z.object({ packageId: packageIdSchema, baseUrl: baseUrlSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ packageId, baseUrl }) => {
      try {
        return toolSuccess(await runPrimeGateCli(withBaseUrl(["resolve", packageId], baseUrl)));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "primegate_verify_package",
    {
      title: "Verify a PrimeGate package",
      description: "Download a package through PrimeGate and compare its SHA-256 hash with the authenticated release manifest.",
      inputSchema: z.object({ packageId: packageIdSchema, baseUrl: baseUrlSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ packageId, baseUrl }) => {
      try {
        return toolSuccess(await runPrimeGateCli(withBaseUrl(["verify", packageId], baseUrl)));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "primegate_install_package",
    {
      title: "Install a PrimeGate package",
      description: "Download a package and its manifest through PrimeGate into a local output directory.",
      inputSchema: z.object({
        packageId: packageIdSchema,
        outputDirectory: z.string().min(1).describe("Local directory where the package folder will be written."),
        baseUrl: baseUrlSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    async ({ packageId, outputDirectory, baseUrl }) => {
      try {
        return toolSuccess(
          await runPrimeGateCli(withBaseUrl(["install", packageId, "--output", outputDirectory], baseUrl)),
        );
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerTool(
    "primegate_publish_packages",
    {
      title: "Publish real packages to PrimeGate",
      description:
        "Publish every package in a local PrimeGate manifest. This creates real PrimeGate releases, uploads encrypted bytes to Shelby, signs with the local publisher wallet, and asks the configured sponsor to pay approved Aptos and Shelby fees. This is an external write and is not a dry run.",
      inputSchema: z.object({
        manifestPath: z.string().min(1).describe("Path to the PrimeGate publish manifest JSON file."),
        walletPath: z
          .string()
          .min(1)
          .optional()
          .describe("Optional local publisher wallet JSON path. PrimeGate creates its protected default wallet when omitted."),
        savePath: z.string().min(1).optional().describe("Optional path for saving the publication result JSON."),
        continueOnError: z.boolean().default(false).describe("Continue with later manifest entries after a failure."),
        baseUrl: baseUrlSchema,
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ manifestPath, walletPath, savePath, continueOnError, baseUrl }) => {
      const args = ["publish", "--manifest", manifestPath];
      if (walletPath) args.push("--wallet", walletPath);
      if (savePath) args.push("--save", savePath);
      if (continueOnError) args.push("--continue-on-error");

      try {
        return toolSuccess(await runPrimeGateCli(withBaseUrl(args, baseUrl)));
      } catch (error) {
        return toolFailure(error);
      }
    },
  );

  server.registerResource(
    "primegate-package",
    new ResourceTemplate("mcp://primegate.io/packages/{packageId}", { list: undefined }),
    {
      title: "PrimeGate package release",
      description: "Resolved PrimeGate package metadata and authenticated installation paths.",
      mimeType: "application/json",
    },
    async (uri, variables) => {
      const packageId = String(variables.packageId ?? "");
      const parsedPackageId = packageIdSchema.safeParse(packageId);
      if (!parsedPackageId.success) {
        throw new Error("The PrimeGate package resource requires a valid package UUID.");
      }

      const response = await fetch(
        `${normalizeBaseUrl()}/api/packages/${encodeURIComponent(parsedPackageId.data)}/resolve`,
        { headers: { Accept: "application/json" } },
      );
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`PrimeGate resolve failed with HTTP ${response.status}: ${text}`);
      }

      const payload = JSON.parse(text) as { data?: unknown };
      const resolution = payload.data ?? payload;

      return {
        contents: [{ uri: uri.href, mimeType: "application/json", text: JSON.stringify(resolution, null, 2) }],
      };
    },
  );

  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  serveStdio(() => buildPrimeGateMcpServer(), {
    onerror: (error) => console.error(error.message),
  });
}
