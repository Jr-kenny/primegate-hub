import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { Client } from "@modelcontextprotocol/client";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const packageId = process.env.PRIMEGATE_MCP_SMOKE_PACKAGE_ID ?? "fcfe3dd6-ee70-4ceb-a104-b91935233f50";
const baseUrl = process.env.PRIMEGATE_BASE_URL ?? "https://primegatelive.vercel.app";
const root = process.cwd();
const installRoot = await mkdtemp(path.join(os.tmpdir(), "primegate-mcp-smoke-"));
const transport = new StdioClientTransport({
  command: "pnpm",
  args: ["--silent", "--dir", root, "primegate:mcp"],
  cwd: root,
  env: { ...getDefaultEnvironment(), PRIMEGATE_BASE_URL: baseUrl },
  stderr: "pipe",
});
const client = new Client({ name: "primegate-mcp-smoke", version: "1.0.0" });

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name).sort();
  assert.deepEqual(toolNames, [
    "primegate_install_package",
    "primegate_publish_packages",
    "primegate_resolve_package",
    "primegate_search_packages",
    "primegate_verify_package",
  ]);

  const search = await client.callTool({
    name: "primegate_search_packages",
    arguments: { query: "Aptos sponsored transaction guard", baseUrl },
  });
  assert.equal(search.isError, undefined);
  const searchResult = search.structuredContent as { results?: Array<{ id?: string }> } | undefined;
  assert.equal(searchResult?.results?.some((entry) => entry.id === packageId), true);

  const resolved = await client.callTool({
    name: "primegate_resolve_package",
    arguments: { packageId, baseUrl },
  });
  assert.equal(resolved.isError, undefined);
  const resolution = resolved.structuredContent as { packageId?: string } | undefined;
  assert.equal(resolution?.packageId, packageId);

  const verification = await client.callTool({
    name: "primegate_verify_package",
    arguments: { packageId, baseUrl },
  });
  assert.equal(verification.isError, undefined);
  const verificationResult = verification.structuredContent as { verified?: boolean } | undefined;
  assert.equal(verificationResult?.verified, true);

  const installation = await client.callTool({
    name: "primegate_install_package",
    arguments: { packageId, outputDirectory: installRoot, baseUrl },
  });
  assert.equal(installation.isError, undefined);
  const installationResult = installation.structuredContent as { packageId?: string } | undefined;
  assert.equal(installationResult?.packageId, packageId);

  const resource = await client.readResource({ uri: `mcp://primegate.io/packages/${packageId}` });
  assert.equal(resource.contents.length, 1);
  const resourceText = "text" in resource.contents[0] ? resource.contents[0].text : "";
  const resourceResolution = JSON.parse(resourceText) as { packageId?: string };
  assert.equal(resourceResolution.packageId, packageId);

  console.log(
    JSON.stringify({ installed: true, packageId, resource: true, searched: true, tools: toolNames, verified: true }, null, 2),
  );
} finally {
  await client.close();
  await rm(installRoot, { recursive: true, force: true });
}
