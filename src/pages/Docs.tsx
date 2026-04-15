import { Book, Code, Link2, Plug, Terminal } from "lucide-react";

const sections = [
  {
    icon: Book,
    title: "Search",
    desc: "Start with PrimeGate search to find package ids and canonical handles.",
  },
  {
    icon: Link2,
    title: "Resolve",
    desc: "Resolve by package id to get PrimeGate manifest + download URLs.",
  },
  {
    icon: Terminal,
    title: "Install",
    desc: "Use the CLI or SDK helper to download artifacts via PrimeGate.",
  },
  {
    icon: Plug,
    title: "Automate",
    desc: "MCP tools should resolve through PrimeGate instead of talking to Shelby directly.",
  },
] as const;

const searchSnippet = `curl "https://primegate.io/api/search?q=prompt"`;
const resolveSnippet = `curl "https://primegate.io/api/packages/<package-id>/resolve"`;
const manifestSnippet = `curl "https://primegate.io/api/packages/<package-id>/manifest"`;
const downloadSnippet = `curl "https://primegate.io/api/packages/<package-id>/download"`;
const sdkSnippet = `import { createPrimeGateClient } from "@/lib/primegate-client";

const client = createPrimeGateClient({
  baseUrl: "https://primegate.io",
  getAuthToken: () => process.env.PRIMEGATE_SESSION_TOKEN,
});

const results = await client.searchPackages("dataset");
const resolved = await client.resolvePackage(results[0].id);

if (resolved.downloadUrl) {
  const artifact = await client.downloadArtifact(resolved.packageId);
  console.log(artifact.fileName, artifact.contentType);
}`;
const cliSnippet = `primegate search "dataset"
primegate resolve <package-id>
primegate install <package-id>`;
const mcpSnippet = `mcp://primegate.io/packages/<package-id>
resolve -> manifest -> download`;

export default function Docs() {
  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          PrimeGate exposes a single canonical flow for search, resolve, manifests, and downloads. Use this flow
          across web, CLI, SDK, and MCP so clients never bypass PrimeGate for Shelby data.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">Quick Start (Canonical Flow)</h2>
        <ol className="list-decimal pl-5 text-sm text-muted-foreground space-y-1">
          <li>Search `/api/search` to discover package ids.</li>
          <li>Resolve `/api/packages/:id/resolve` to get PrimeGate manifest + download URLs.</li>
          <li>Fetch the manifest and download the artifact from PrimeGate URLs.</li>
          <li>Install locally (CLI or SDK), or automate via MCP.</li>
        </ol>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-secondary/30"
          >
            <section.icon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <p className="text-sm text-muted-foreground">{section.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">HTTP Contract</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Use the HTTP contract as the source of truth. Do not fetch Shelby blobs directly from clients.
        </p>
        <div className="space-y-2">
          <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{searchSnippet}</div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{resolveSnippet}</div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{manifestSnippet}</div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{downloadSnippet}</div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Code className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">TypeScript Client</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The repo includes a thin `createPrimeGateClient` helper for search, package lookup, resolution,
          manifest fetches, and artifact downloads.
        </p>
        <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap break-all">
          {sdkSnippet}
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">CLI Flow</h2>
        </div>
        <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap">{cliSnippet}</div>
      </div>

      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Plug className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold">MCP Flow</h2>
        </div>
        <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap">{mcpSnippet}</div>
      </div>
    </div>
  );
}
