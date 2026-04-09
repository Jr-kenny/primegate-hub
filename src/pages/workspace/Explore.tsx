import { Link } from "react-router-dom";
import { Search, Package } from "lucide-react";

import { useDiscoverPackages } from "@/hooks/usePrimeGateCatalog";
import { formatPrimeGatePackageTypeLabel } from "@/lib/primegate-package-type";

export default function WorkspaceExplore() {
  const { data: packages = [], isLoading } = useDiscoverPackages();
  const recommendedPackages = packages.slice(0, 4).map((pkg) => ({
    id: pkg.id,
    name: pkg.name,
    subtitle: `${formatPrimeGatePackageTypeLabel(pkg.type)} · ${pkg.agentReady ? "Agent-ready" : "Human tooling"}`,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Explore</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          placeholder="Search installed packages, registry, capabilities…"
          className="w-full h-10 rounded-md border bg-secondary/30 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <div className="space-y-1">
        {isLoading && recommendedPackages.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Loading recommended packages...
          </div>
        ) : (
          recommendedPackages.map((pkg) => (
            <Link
              key={pkg.id}
              to={`/package/${pkg.id}`}
              className="flex items-center gap-3 p-3 rounded-md hover:bg-secondary/50 transition-colors"
            >
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-mono font-medium">{pkg.name}</p>
                <p className="text-xs text-muted-foreground">{pkg.subtitle}</p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
