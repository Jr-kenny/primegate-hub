#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { PrimeGateClientError, createPrimeGateClient } from "../lib/primegate-client";
import { formatPrimeGatePackageTypeLabel } from "../lib/primegate-package-type";

type CliOptions = {
  baseUrl?: string;
  json?: boolean;
  output?: string;
  token?: string;
};

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";

function printHelp() {
  console.log(`PrimeGate CLI

Usage:
  pnpm primegate search <query> [--base-url <url>] [--json]
  pnpm primegate resolve <package-id> [--base-url <url>] [--json] [--token <token>]
  pnpm primegate install <package-id> [--base-url <url>] [--output <dir>] [--json] [--token <token>]

Defaults:
  --base-url ${DEFAULT_BASE_URL}
  --token PRIMEGATE_SESSION_TOKEN
`);
}

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const entry = argv[index];
    if (!entry) {
      continue;
    }

    if (!entry.startsWith("--")) {
      positional.push(entry);
      continue;
    }

    if (entry === "--json") {
      options.json = true;
      continue;
    }

    const nextValue = argv[index + 1];
    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for ${entry}.`);
    }

    if (entry === "--base-url") {
      options.baseUrl = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--output") {
      options.output = nextValue;
      index += 1;
      continue;
    }

    if (entry === "--token") {
      options.token = nextValue;
      index += 1;
      continue;
    }

    throw new Error(`Unknown option: ${entry}`);
  }

  return { options, positional };
}

function getClient(options: CliOptions) {
  return createPrimeGateClient({
    baseUrl: options.baseUrl ?? process.env.PRIMEGATE_BASE_URL ?? DEFAULT_BASE_URL,
    getAuthToken: () => options.token ?? process.env.PRIMEGATE_SESSION_TOKEN,
  });
}

function formatBytes(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPackageIdentity(packageId: string, packageName: string, packageHandle?: string | null) {
  return packageHandle ? `${packageName} [${packageHandle}]` : `${packageName} [${packageId}]`;
}

async function runSearch(query: string, options: CliOptions) {
  const client = getClient(options);
  const results = await client.searchPackages(query);

  if (options.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  if (results.length === 0) {
    console.log(`No PrimeGate packages matched "${query}".`);
    return;
  }

  for (const pkg of results) {
    console.log(pkg.name);
    console.log(`  id: ${pkg.id}`);
    if (pkg.packageHandle) {
      console.log(`  handle: ${pkg.packageHandle}`);
    }
    console.log(`  ${formatPrimeGatePackageTypeLabel(pkg.type)} · ${pkg.price} · ${pkg.publisher}`);
    console.log(`  ${pkg.description}`);
  }
}

async function runResolve(packageId: string, options: CliOptions) {
  const client = getClient(options);
  const resolution = await client.resolvePackage(packageId);

  if (options.json) {
    console.log(JSON.stringify(resolution, null, 2));
    return;
  }

  console.log(
    `${formatPackageIdentity(resolution.packageId, resolution.packageName, resolution.packageHandle)} (${resolution.version})`,
  );
  console.log(`Release ID: ${resolution.packageId}`);
  console.log(`Resolve: ${resolution.resolveUrl}`);
  console.log(`Access: ${resolution.access}`);
  console.log(`Price: ${resolution.price}`);

  if (resolution.artifact) {
    console.log(
      `Artifact: ${resolution.artifact.originalFileName} (${formatBytes(resolution.artifact.sizeBytes)})`,
    );
    console.log(`Manifest: ${resolution.manifestUrl}`);
    console.log(`Download: ${resolution.downloadUrl}`);
  } else {
    console.log("Artifact: not exposed yet for this caller.");
  }

  console.log(`CLI: ${resolution.install.cli}`);
  console.log(`SDK: ${resolution.install.sdk}`);
  console.log(`MCP: ${resolution.install.mcp}`);
}

async function runInstall(packageId: string, options: CliOptions) {
  const client = getClient(options);
  const resolution = await client.resolvePackage(packageId);

  if (!resolution.downloadUrl || !resolution.artifact) {
    throw new Error(
      resolution.access === "purchase-required"
        ? "This package requires entitlement before PrimeGate will expose the artifact."
        : "This package does not expose a downloadable artifact.",
    );
  }

  const outputRoot = path.resolve(options.output ?? path.join(process.cwd(), "primegate-downloads"));
  const packageOutputDir = path.join(outputRoot, packageId);
  await mkdir(packageOutputDir, { recursive: true });

  const artifact = await client.downloadArtifact(packageId);
  const artifactFileName = artifact.fileName ?? resolution.artifact.originalFileName;
  const artifactPath = path.join(packageOutputDir, artifactFileName);
  await writeFile(artifactPath, Buffer.from(artifact.arrayBuffer));

  const manifest = await client.getPackageManifest(packageId);
  const manifestPath = path.join(packageOutputDir, "primegate-manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");

  const result = {
    access: resolution.access,
    artifactPath,
    downloadUrl: resolution.downloadUrl,
    manifestPath,
    manifestUrl: resolution.manifestUrl,
    packageHandle: resolution.packageHandle ?? null,
    packageId: resolution.packageId,
    packageName: resolution.packageName,
    resolveUrl: resolution.resolveUrl,
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(
    `Installed ${formatPackageIdentity(resolution.packageId, resolution.packageName, resolution.packageHandle)}`,
  );
  console.log(`Artifact: ${artifactPath}`);
  console.log(`Manifest: ${manifestPath}`);
  console.log(`Resolve: ${resolution.resolveUrl}`);
  if (artifactFileName.toLowerCase().endsWith(".zip")) {
    console.log("Archive: packaged bundle downloaded. Extract it locally to use the full contents.");
  }
}

async function main() {
  const { options, positional } = parseArgs(process.argv.slice(2));
  const [command, ...rest] = positional;

  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (command === "search") {
    if (rest.length === 0) {
      throw new Error("search requires a query.");
    }

    await runSearch(rest.join(" "), options);
    return;
  }

  if (command === "resolve") {
    const packageId = rest[0];
    if (!packageId) {
      throw new Error("resolve requires a package id.");
    }

    await runResolve(packageId, options);
    return;
  }

  if (command === "install") {
    const packageId = rest[0];
    if (!packageId) {
      throw new Error("install requires a package id.");
    }

    await runInstall(packageId, options);
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main().catch((error: unknown) => {
  if (error instanceof PrimeGateClientError) {
    console.error(`PrimeGate API error (${error.status}) on ${error.path}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  console.error("PrimeGate CLI failed.");
  process.exitCode = 1;
});
