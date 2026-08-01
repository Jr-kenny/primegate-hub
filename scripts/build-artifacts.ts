import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type ArtifactItem = {
  title: string;
  description: string;
  packageSlug: string;
  releaseVersion: string;
  priceApt: string;
  filePath: string;
  source: "generated" | "external";
};

const ROOT = path.resolve(process.cwd(), "artifacts");
const GENERATED_DIR = path.join(ROOT, "generated");
const EXTERNAL_DIR = path.join(ROOT, "external");

const EXTERNAL_ASSETS = [
  {
    fileName: "usgs-earthquakes-all-day.geojson",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
    title: "USGS Earthquakes (All Day, GeoJSON)",
    description: "Latest 24 hours of USGS earthquake events in GeoJSON format.",
  },
  {
    fileName: "usgs-earthquakes-all-day.csv",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv",
    title: "USGS Earthquakes (All Day, CSV)",
    description: "Latest 24 hours of USGS earthquake events in CSV format.",
  },
  {
    fileName: "usgs-earthquakes-all-week.geojson",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson",
    title: "USGS Earthquakes (All Week, GeoJSON)",
    description: "Latest 7 days of USGS earthquake events in GeoJSON format.",
  },
  {
    fileName: "usgs-earthquakes-all-week.csv",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.csv",
    title: "USGS Earthquakes (All Week, CSV)",
    description: "Latest 7 days of USGS earthquake events in CSV format.",
  },
  {
    fileName: "usgs-earthquakes-significant-month.geojson",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson",
    title: "USGS Earthquakes (Significant, 30 Days)",
    description: "Significant earthquakes from the last 30 days in GeoJSON format.",
  },
  {
    fileName: "usgs-earthquakes-significant-month.csv",
    url: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.csv",
    title: "USGS Earthquakes (Significant, 30 Days CSV)",
    description: "Significant earthquakes from the last 30 days in CSV format.",
  },
];

const GENERATED_ASSETS = [
  {
    fileName: "primegate-release-checklist.md",
    title: "PrimeGate Release Gatekeeper Checklist",
    description: "Release gate checklist for publish intent, Shelby upload, and install validation.",
    priceApt: "0.5",
    content: `# PrimeGate Release Checklist

1. Confirm package slug, version, and price metadata are correct.
2. Run local validation on the artifact payload (hash, size, mime type).
3. Publish to Shelby and verify the manifest upload.
4. Finalize publish in PrimeGate and verify listing visibility.
5. Run the install flow via CLI and confirm manifest + artifact integrity.
6. Log release notes and provide support contact details.`,
  },
  {
    fileName: "primegate-pricing-playbook.md",
    title: "PrimeGate Pricing Ladder Playbook",
    description: "Pricing ladder and upgrade rules for PrimeGate testnet releases.",
    priceApt: "1.25",
    content: `# PrimeGate Pricing Playbook

- Free: exploratory tools, documentation, and lightweight prompts.
- Entry (0.1 - 0.5 APT): starter templates and single-purpose assets.
- Core (0.75 - 2 APT): tooling bundles and curated datasets.
- Premium (3 - 5 APT): automation packs and production-ready workflows.

Upgrade policy suggestions:
- Minor release: free update within 30 days.
- Major release: require a new purchase.`,
  },
  {
    fileName: "registry-audit.prompt",
    title: "Registry Integrity Audit Prompt",
    description: "Audit prompt for metadata completeness, price consistency, and manifest integrity.",
    priceApt: "0.75",
    content: `You are auditing a registry package.

Check:
- slug normalization and version format
- metadata completeness (title, description, price)
- manifest structure integrity
- download url accessibility
- entitlement rules for paid assets

Return:
1. pass/fail
2. issues list with severity
3. recommended fixes`,
  },
  {
    fileName: "install-validation.prompt",
    title: "Install Validation Checklist Prompt",
    description: "Prompt for verifying artifact hashes, manifest URLs, and install outcomes.",
    priceApt: "0.25",
    content: `Verify the install output for correctness.

Inputs:
- package id
- manifest payload
- downloaded artifact metadata

Tasks:
- ensure manifest URLs are reachable
- ensure artifact hashes match
- note any missing fields`,
  },
  {
    fileName: "primegate-cli-starter.md",
    title: "PrimeGate CLI Quickstart Field Guide",
    description: "Field guide for running PrimeGate CLI search, resolve, and install commands.",
    priceApt: "0",
    content: `# PrimeGate CLI Starter

Commands:
- Search: pnpm primegate search "query"
- Resolve: pnpm primegate resolve <package-id>
- Install: pnpm primegate install <package-id> --output ./downloads

Tips:
- Use PRIMEGATE_BASE_URL to target a remote API.
- Use PRIMEGATE_SESSION_TOKEN for authenticated flows.`,
  },
  {
    fileName: "registry-metadata-template.json",
    title: "Registry Metadata JSON Blueprint",
    description: "Blueprint JSON structure for registry metadata payloads.",
    priceApt: "0.4",
    content: `{
  "title": "Package Title",
  "description": "Short description",
  "packageSlug": "publisher/package",
  "releaseVersion": "1.0.0",
  "priceApt": "0.5",
  "artifact": {
    "name": "bundle.zip",
    "sizeBytes": 123456
  }
}`,
  },
  {
    fileName: "primegate-workflow.yaml",
    title: "PrimeGate Publish Workflow Spec",
    description: "Workflow specification for PrimeGate publish, finalize, and verify steps.",
    priceApt: "1.5",
    content: `name: primegate-publish
steps:
  - id: prepare
    run: validate-metadata
  - id: publish
    run: publish-to-shelby
  - id: finalize
    run: finalize-primegate
  - id: verify
    run: run-install-tests`,
  },
  {
    fileName: "synthetic-registry-sample.csv",
    title: "Synthetic Registry Sample Pack (CSV)",
    description: "Synthetic dataset of registry entries for analytics and demo testing.",
    priceApt: "0.1",
    content: `package_id,name,type,price,installs
pg-001,Edge Monitor,source,0.5,42
pg-002,Prompt Triage,prompt,0,188
pg-003,Dataset Pack,dataset,1.2,12`,
  },
  {
    fileName: "synthetic-registry-sample.jsonl",
    title: "Synthetic Registry Sample Pack (JSONL)",
    description: "JSONL version of synthetic registry entries.",
    priceApt: "0.1",
    content: `{"package_id":"pg-001","name":"Edge Monitor","type":"source","price":"0.5","installs":42}
{"package_id":"pg-002","name":"Prompt Triage","type":"prompt","price":"0","installs":188}
{"package_id":"pg-003","name":"Dataset Pack","type":"dataset","price":"1.2","installs":12}`,
  },
  {
    fileName: "primegate-install-script.ts",
    title: "PrimeGate Programmatic Install Helper (TS)",
    description: "TypeScript helper for resolving and installing PrimeGate artifacts programmatically.",
    priceApt: "2.0",
    content: `import { createPrimeGateClient } from "@/lib/primegate-client";

async function installPackage(id: string) {
  const client = createPrimeGateClient({ baseUrl: "http://127.0.0.1:3000" });
  const artifact = await client.downloadArtifact(id);
  const manifest = await client.getPackageManifest(id);
  return { artifact, manifest };
}`,
  },
  {
    fileName: "primegate-install-script.py",
    title: "PrimeGate Install Script (Python Pseudocode)",
    description: "Python pseudocode for resolving and installing PrimeGate artifacts.",
    priceApt: "0",
    content: `import requests

def install(package_id):
    resolve = requests.get(f"http://127.0.0.1:3000/api/packages/{package_id}/resolve").json()["data"]
    artifact = requests.get(resolve["downloadUrl"]).content
    manifest = requests.get(resolve["manifestUrl"]).json()
    return artifact, manifest`,
  },
  {
    fileName: "primegate-ops-notes.md",
    title: "PrimeGate Ops Field Notes",
    description: "Operational field notes for monitoring and alerting a registry.",
    priceApt: "3.5",
    content: `# PrimeGate Ops Notes

- Monitor publish intent failure rates.
- Track install latency and download errors.
- Alert when Shelby RPC upload latency exceeds 10s.`,
  },
  {
    fileName: "primegate-support-matrix.md",
    title: "PrimeGate Support Tiers Matrix",
    description: "Support tier matrix with response expectations.",
    priceApt: "0.9",
    content: `# PrimeGate Support Matrix

| Tier | Response | Scope |
| --- | --- | --- |
| Community | 72h | Docs + FAQs |
| Standard | 24h | Basic troubleshooting |
| Premium | 4h | Priority support |`,
  },
  {
    fileName: "primegate-onboarding-guide.md",
    title: "PrimeGate Publisher Onboarding Guide",
    description: "Onboarding steps for new PrimeGate publishers.",
    priceApt: "0",
    content: `# PrimeGate Onboarding

1. Connect your Aptos wallet.
2. Verify your wallet session.
3. Upload your artifact and manifest.
4. Set pricing and publish.`,
  },
];

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

async function download(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

function toManifestFilePath(filePath: string) {
  return path.relative(process.cwd(), filePath).split(path.sep).join("/");
}

async function main() {
  await ensureDir(ROOT);
  await ensureDir(GENERATED_DIR);
  await ensureDir(EXTERNAL_DIR);

  const items: ArtifactItem[] = [];

  for (const asset of GENERATED_ASSETS) {
    const filePath = path.join(GENERATED_DIR, asset.fileName);
    await writeFile(filePath, asset.content, "utf8");
    items.push({
      title: asset.title,
      description: asset.description,
      packageSlug: asset.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      releaseVersion: "1.0.0",
      priceApt: asset.priceApt,
      filePath: toManifestFilePath(filePath),
      source: "generated",
    });
  }

  for (const asset of EXTERNAL_ASSETS) {
    const filePath = path.join(EXTERNAL_DIR, asset.fileName);
    const bytes = await download(asset.url);
    await writeFile(filePath, bytes);
    items.push({
      title: asset.title,
      description: asset.description,
      packageSlug: asset.fileName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9]+/gi, "-").toLowerCase(),
      releaseVersion: "1.0.0",
      priceApt: "0",
      filePath: toManifestFilePath(filePath),
      source: "external",
    });
  }

  const manifestPath = path.join(ROOT, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ items }, null, 2), "utf8");

  const sourcesPath = path.join(ROOT, "SOURCES.md");
  await writeFile(
    sourcesPath,
    `# External Sources

USGS Earthquake feeds are public domain data provided by the U.S. Geological Survey.
USGS confirms USGS-authored data and information are in the U.S. public domain:
https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted

Sources:
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.csv
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.csv
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson
- https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.csv
`,
    "utf8",
  );

  const readmePath = path.join(ROOT, "README.md");
  await writeFile(
    readmePath,
    `# PrimeGate Seed Artifacts

This folder contains generated artifacts and public-domain external assets.
Use scripts/build-artifacts.ts to regenerate the list and artifacts/manifest.json.
`,
    "utf8",
  );

  console.log(`Wrote ${items.length} artifacts to ${ROOT}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Artifact generation failed.");
  process.exitCode = 1;
});
