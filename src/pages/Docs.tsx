import { Book, Code, Link2, Plug, Terminal } from "lucide-react";

const sections = [
  {
    icon: Book,
    title: "Getting Started",
    desc: "Search PrimeGate, resolve the package id, then follow the canonical manifest and download URLs.",
  },
  {
    icon: Terminal,
    title: "CLI Flow",
    desc: "The CLI should search and resolve through PrimeGate before downloading artifacts.",
  },
  {
    icon: Code,
    title: "TypeScript Client",
    desc: "A thin PrimeGate client lives in this repo so SDK-style consumers can use the same public contract.",
  },
  {
    icon: Plug,
    title: "MCP Protocol",
    desc: "MCP tools should resolve package ids through PrimeGate instead of talking to Shelby directly.",
  },
] as const;

const searchSnippet = `curl "https://primegate.io/api/search?q=prompt"`;
const resolveSnippet = `curl "https://primegate.io/api/packages/<package-id>/resolve"`;
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
          Integrate PrimeGate from any surface. Search, resolution, manifests, and downloads should all flow through
          PrimeGate as the canonical registry layer.
        </p>
      </div>

      <div className="space-y-3">
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

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold">HTTP Contract</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Every external client should start from search, then resolve by package id.
          </p>
          <div className="space-y-2">
            <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{searchSnippet}</div>
            <div className="rounded-md bg-secondary p-3 font-mono text-sm break-all">{resolveSnippet}</div>
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-2">
          <h2 className="text-sm font-semibold">CLI / MCP Shape</h2>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap">{cliSnippet}</div>
          <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap">{mcpSnippet}</div>
        </div>
      </div>

      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-sm font-semibold">TypeScript Client</h2>
        <p className="text-sm text-muted-foreground">
          The repo includes a thin `createPrimeGateClient` helper for search, package lookup, resolution,
          manifest fetches, and artifact downloads.
        </p>
        <div className="rounded-md bg-secondary p-3 font-mono text-sm whitespace-pre-wrap break-all">
          {sdkSnippet}
        </div>
      </div>
    </div>
  );
}
