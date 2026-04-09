import { Link } from "react-router-dom";
import { Archive, Box, Braces, Database, FileText, Image } from "lucide-react";
import { useMemo } from "react";

import { useDiscoverPackages } from "@/hooks/usePrimeGateCatalog";
import { formatPrimeGatePackageTypeLabel, type PrimeGatePackageType } from "@/lib/primegate-package-type";

const categories: { type: PrimeGatePackageType; icon: typeof Archive }[] = [
  { type: "archive", icon: Archive },
  { type: "dataset", icon: Database },
  { type: "document", icon: FileText },
  { type: "image", icon: Image },
  { type: "prompt", icon: FileText },
  { type: "source", icon: Braces },
  { type: "binary", icon: Box },
];

export default function Categories() {
  const { data: packages = [], isLoading } = useDiscoverPackages();
  const counts = useMemo(() => {
    const next: Record<string, number> = {};
    for (const pkg of packages) {
      const type = pkg.type?.toLowerCase() || "unknown";
      next[type] = (next[type] ?? 0) + 1;
    }
    return next;
  }, [packages]);

  return (
    <div className="container py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-muted-foreground">Browse the registry by asset type.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const label = formatPrimeGatePackageTypeLabel(cat.type);
          const count = counts[cat.type] ?? 0;
          return (
          <Link
            key={cat.type}
            to={`/discover?type=${cat.type}`}
            className="flex items-center gap-4 p-4 rounded-lg border hover:bg-secondary/50 transition-colors group"
          >
            <cat.icon className="h-5 w-5 text-accent shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium group-hover:text-accent transition-colors">{label}</p>
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Loading..." : `${count.toLocaleString()} assets`}
              </p>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
