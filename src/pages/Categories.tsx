import { Link } from "react-router-dom";
import { Archive, Box, Braces, Database, FileText, Image } from "lucide-react";
import { useMemo } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
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
      <PageHeader
        eyebrow="BROWSE BY TYPE"
        title="Categories"
        subtitle="Browse the registry by asset type."
      />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {categories.map((cat) => {
          const label = formatPrimeGatePackageTypeLabel(cat.type);
          const count = counts[cat.type] ?? 0;
          return (
          <Link
            key={cat.type}
            to={`/discover?type=${cat.type}`}
            className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
              <cat.icon className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-serif text-base font-semibold transition-colors group-hover:text-primary">
                {label}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {isLoading ? "Loading…" : `${count.toLocaleString()} assets`}
              </p>
            </div>
          </Link>
          );
        })}
      </div>
    </div>
  );
}
