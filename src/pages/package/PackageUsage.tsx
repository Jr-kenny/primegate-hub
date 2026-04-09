import { Link2 } from "lucide-react";

import { usePrimeGatePackageResolution } from "@/hooks/usePrimeGateCatalog";
import { usePackageRouteData } from "@/hooks/usePackageRouteData";

export default function PackageUsage() {
  const { pkg } = usePackageRouteData();
  const { data: resolution, isLoading } = usePrimeGatePackageResolution(pkg.id);

  return (
    <div className="space-y-4">
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold">PrimeGate Resolution</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          PrimeGate is the canonical package source. Clients should search by package name or handle, resolve the
          exact release id they want, then follow the returned manifest and artifact URLs instead of querying Shelby
          directly.
        </p>
        <div className="font-mono text-sm bg-secondary rounded-md p-3 break-all">
          {isLoading ? "Loading PrimeGate resolution..." : resolution?.resolveUrl ?? `/api/packages/${pkg.id}/resolve`}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-md border p-4 space-y-2">
          <p className="text-xs font-medium text-accent uppercase tracking-wide">CLI</p>
          <div className="font-mono text-sm bg-secondary rounded-md p-3">
            {resolution?.install.cli ?? `primegate install ${pkg.name}`}
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <p className="text-xs font-medium text-accent uppercase tracking-wide">SDK</p>
          <div className="font-mono text-sm bg-secondary rounded-md p-3">
            {resolution?.install.sdk ?? pkg.usageSnippet}
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <p className="text-xs font-medium text-accent uppercase tracking-wide">MCP</p>
          <div className="font-mono text-sm bg-secondary rounded-md p-3">
            {resolution?.install.mcp ?? `mcp://primegate.io/packages/${pkg.id}`}
          </div>
        </div>

        <div className="rounded-md border p-4 space-y-2">
          <p className="text-xs font-medium text-accent uppercase tracking-wide">HTTP</p>
          <div className="font-mono text-sm bg-secondary rounded-md p-3 break-all">
            {isLoading
              ? "curl <primegate>/api/packages/{id}/resolve"
              : `curl "${resolution?.resolveUrl ?? `/api/packages/${pkg.id}/resolve`}"`}
          </div>
        </div>
      </div>

      <div className="rounded-md border p-4 space-y-2">
        <p className="text-xs font-medium text-accent uppercase tracking-wide">Artifact Flow</p>
        <p className="text-sm text-muted-foreground">
          Search returns package names and handles, while resolution and purchase stay bound to the exact release id.
          Resolution returns the PrimeGate manifest and download URLs for entitled clients. For public artifacts, those
          URLs can be used immediately.
        </p>
        <div className="font-mono text-sm bg-secondary rounded-md p-3 break-all">
          {isLoading
            ? "manifest: /api/packages/{id}/manifest"
            : `manifest: ${resolution?.manifestUrl ?? "not exposed"}`}
        </div>
        <div className="font-mono text-sm bg-secondary rounded-md p-3 break-all">
          {isLoading
            ? "download: /api/packages/{id}/download"
            : `download: ${resolution?.downloadUrl ?? "entitlement required or not exposed"}`}
        </div>
      </div>
    </div>
  );
}
