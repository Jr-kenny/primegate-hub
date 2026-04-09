import { createPrimeGateClient } from "@/lib/primegate-client";

async function installPackage(id: string) {
  const client = createPrimeGateClient({ baseUrl: "http://127.0.0.1:3000" });
  const artifact = await client.downloadArtifact(id);
  const manifest = await client.getPackageManifest(id);
  return { artifact, manifest };
}