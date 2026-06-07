import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { ArrowLeft, Download } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { usePrimeGatePackage } from "@/hooks/usePrimeGateCatalog";

const detailTabs = [
  { label: "Overview", to: ".", end: true },
  { label: "Versions", to: "versions" },
  { label: "Install", to: "install" },
  { label: "Usage", to: "usage" },
  { label: "Reviews", to: "reviews" },
  { label: "Publisher", to: "publisher" },
];

export default function PackageDetail() {
  const { id } = useParams();
  const { data: pkg, isLoading } = usePrimeGatePackage(id);

  if (isLoading || !pkg) {
    return (
      <div className="container py-8 max-w-4xl">
        <div className="pg-fade-up rounded-md border bg-card p-6">
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-3/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-10 w-40" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-6 max-w-4xl">
      <Link to="/discover" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Back to Discover
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{pkg.name}</h1>
            {pkg.verified && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">Verified</span>
            )}
            {!pkg.verified && pkg.publisher.startsWith("0x") && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-medium">
                Published on PrimeGate
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{pkg.description}</p>
          {pkg.packageHandle && (
            <p className="text-xs font-mono text-muted-foreground">{pkg.packageHandle}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>v{pkg.version}</span>
            <span>&middot;</span>
            <span>{pkg.installs.toLocaleString()} installs</span>
            <span>&middot;</span>
            <Link to={`/publisher/${pkg.publisher}`} className="hover:text-foreground">
              {pkg.publisher}
            </Link>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to="install"
            className="flex items-center gap-2 h-9 rounded-md bg-accent px-4 text-sm font-medium text-accent-foreground hover:bg-accent/90 transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Install
          </Link>
        </div>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">
        {detailTabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? "border-accent text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </div>

      <div className="min-h-[300px]">
        <Outlet context={{ pkg }} />
      </div>
    </div>
  );
}
