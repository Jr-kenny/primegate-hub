import { Link } from "react-router-dom";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";
import { formatPrimeGateBytes } from "@/lib/publisher-billing";

export default function Publishing() {
  const { publishedAssets, publisherBilling, sales } = usePrimeGateRegistry();
  const packageCount = useMemo(() => {
    return new Set(publishedAssets.map((asset) => asset.packageHandle)).size;
  }, [publishedAssets]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">Publishing</h1>
          <p className="text-sm text-muted-foreground">Manage your published assets.</p>
        </div>
        <Button asChild>
          <Link to="/publish">Create Listing</Link>
        </Button>
      </div>
      {publisherBilling && (
        <div className="rounded-md border bg-card p-4 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{publisherBilling.plan.name} plan</p>
              <p className="text-xs text-muted-foreground">
                Monthly publishing and delivery allowance
              </p>
            </div>
            <span className="rounded-full bg-secondary px-2 py-1 text-xs text-muted-foreground">
              Hybrid billing
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                label: "Publishing",
                used: publisherBilling.publish.usedBytes + publisherBilling.publish.reservedBytes,
                included: publisherBilling.publish.includedBytes,
              },
              {
                label: "Delivery",
                used: publisherBilling.egress.usedBytes,
                included: publisherBilling.egress.includedBytes,
              },
            ].map((meter) => {
              const percentage = Math.min(100, (meter.used / meter.included) * 100);

              return (
                <div key={meter.label} className="space-y-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">{meter.label}</span>
                    <span>
                      {formatPrimeGateBytes(meter.used)} / {formatPrimeGateBytes(meter.included)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {publisherBilling.credits.availableBytes > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatPrimeGateBytes(publisherBilling.credits.availableBytes)} in publisher credits available.
            </p>
          )}
        </div>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: "Packages", path: "/workspace/publishing/packages", count: packageCount },
          { label: "Releases", path: "/workspace/publishing/releases", count: publishedAssets.length },
          { label: "Sales", path: "/workspace/publishing/sales", count: sales.length },
        ].map((item) => (
          <Link
            key={item.label}
            to={item.path}
            className="rounded-md border p-4 hover:bg-secondary/50 transition-colors"
          >
            <p className="text-sm font-medium">{item.label}</p>
            <p className="text-2xl font-bold mt-1">{item.count}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
