import { Link } from "react-router-dom";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { formatAptAmountLabel } from "@/lib/aptos-amount";

export default function PublisherPackages() {
  const { publishedAssets, walletAddress } = usePrimeGateRegistry();
  const packageFamilies = useMemo(() => {
    const groupedPackages = new Map<string, (typeof publishedAssets)[number][]>();

    for (const asset of publishedAssets) {
      const currentAssets = groupedPackages.get(asset.packageHandle) ?? [];
      currentAssets.push(asset);
      groupedPackages.set(asset.packageHandle, currentAssets);
    }

    return Array.from(groupedPackages.entries())
      .map(([packageHandle, releases]) => {
        const sortedReleases = [...releases].sort((left, right) =>
          right.createdAt.localeCompare(left.createdAt),
        );
        return {
          latestRelease: sortedReleases[0],
          packageHandle,
          releaseCount: sortedReleases.length,
        };
      })
      .sort((left, right) => left.latestRelease.createdAt.localeCompare(right.latestRelease.createdAt))
      .reverse();
  }, [publishedAssets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-2xl font-bold">Your Packages</h1>
        <Button asChild>
          <Link to="/publish">New Listing</Link>
        </Button>
      </div>
      {walletAddress && packageFamilies.length > 0 ? (
        <div className="space-y-3">
          {packageFamilies.map(({ latestRelease, packageHandle, releaseCount }) => (
            <div key={packageHandle} className="rounded-md border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{latestRelease.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      v{latestRelease.version}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{packageHandle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {releaseCount} {releaseCount === 1 ? "release" : "releases"} · {latestRelease.originalFileName}
                  </p>
                </div>
                <p className="text-sm font-medium">
                  {latestRelease.price === 0 ? "Free" : formatAptAmountLabel(latestRelease.price)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Latest publish {new Date(latestRelease.createdAt).toLocaleString()}
                </p>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/package/${latestRelease.id}/versions`}>View Versions</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground space-y-4">
          <p>
            {walletAddress
              ? "No packages published yet. Use the CLI or browser publish flow to create your first asset."
              : "Connect your wallet to manage published assets."}
          </p>
          {walletAddress && (
            <Button asChild variant="outline">
              <Link to="/publish">Open Publish Form</Link>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
