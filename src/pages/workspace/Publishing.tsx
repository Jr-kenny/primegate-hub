import { Link } from "react-router-dom";
import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { usePrimeGateRegistry } from "@/hooks/usePrimeGateRegistry";

export default function Publishing() {
  const { publishedAssets, sales } = usePrimeGateRegistry();
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
