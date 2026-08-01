import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { useShelbyPublish } from "@/hooks/useShelbyPublish";
import { formatAptAmountLabel } from "@/lib/aptos-amount";

export default function PublisherReleases() {
  const { publishedAssets, walletAddress } = usePrimeGateRegistry();
  const { retryPublishedAssetListing, retryingListingId } = useShelbyPublish();

  const handleRetryListing = async (asset: (typeof publishedAssets)[number]) => {
    try {
      await retryPublishedAssetListing(asset);
      toast({
        title: "Listing confirmed",
        description: `${asset.title} is available for paid checkout.`,
      });
    } catch (error) {
      toast({
        title: "Listing still needs attention",
        description: error instanceof Error ? error.message : "PrimeGate could not confirm the listing.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-3xl font-semibold tracking-tight">Releases</h1>
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
                    {asset.offer.name} · {asset.releaseChannel} · {new Date(asset.createdAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">Manifest: {asset.manifestBlobName}</p>
                  <p className="text-xs text-muted-foreground">Asset: {asset.assetBlobName}</p>
                  {asset.price > 0 && asset.listingStatus !== "active" && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-secondary p-3">
                      <p className="text-xs text-muted-foreground">
                        {asset.listingError ?? "The paid listing is awaiting on-chain confirmation."}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryingListingId === asset.id}
                        onClick={() => void handleRetryListing(asset)}
                      >
                        {retryingListingId === asset.id ? "Confirming..." : "Retry listing"}
                      </Button>
                    </div>
                  )}
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
