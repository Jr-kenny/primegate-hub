import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { formatAptAmountLabel } from "@/lib/aptos-amount";

export default function PublisherReleases() {
  const { publishedAssets, walletAddress } = usePrimeGateRegistry();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Releases</h1>
      {walletAddress && publishedAssets.length > 0 ? (
        <div className="space-y-3">
          {publishedAssets.map((asset) => (
            <div key={asset.manifestBlobName} className="rounded-md border p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{asset.title}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                      v{asset.version}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{asset.packageHandle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {asset.price === 0 ? "Free" : formatAptAmountLabel(asset.price)} ·{" "}
                    {new Date(asset.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Manifest: {asset.manifestBlobName}</p>
                  <p className="text-xs text-muted-foreground">Asset: {asset.assetBlobName}</p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/package/${asset.id}`}>Open Release</Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center text-sm text-muted-foreground">
          {walletAddress ? "No releases yet." : "Connect your wallet to view releases."}
        </div>
      )}
    </div>
  );
}
