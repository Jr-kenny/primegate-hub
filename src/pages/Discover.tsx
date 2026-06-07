import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { PackageCard } from "@/components/package/PackageCard";
import { PackageCardSkeleton } from "@/components/package/PackageCardSkeleton";
import { useDiscoverPackages } from "@/hooks/usePrimeGateCatalog";
import type { RegistryPackage } from "@/lib/registry-data";
import { discoverFilters, discoverTabs } from "@/lib/registry-data";

function sortByNewness(packages: RegistryPackage[]) {
  return [...packages].sort((left, right) => {
    const leftTime = left.createdAt ? Date.parse(left.createdAt) : 0;
    const rightTime = right.createdAt ? Date.parse(right.createdAt) : 0;
    return rightTime - leftTime || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

function sortFeatured(packages: RegistryPackage[]) {
  return [...packages].sort((left, right) => {
    const leftScore = (left.verified ? 100000 : 0) + (left.agentReady ? 10000 : 0) + left.installs;
    const rightScore = (right.verified ? 100000 : 0) + (right.agentReady ? 10000 : 0) + right.installs;
    return rightScore - leftScore || left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  });
}

export default function Discover() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<(typeof discoverTabs)[number]>("Featured");
  const [showFilters, setShowFilters] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const { data: packages = [], isLoading } = useDiscoverPackages();

  const visiblePackages = useMemo(() => {
    switch (activeTab) {
      case "New":
        return sortByNewness(packages);
      case "Trending":
        return [...packages].sort((left, right) => right.installs - left.installs);
      case "Agent-ready":
        return sortFeatured(packages.filter((pkg) => pkg.agentReady));
      case "Human Tools":
        return sortFeatured(packages.filter((pkg) => !pkg.agentReady));
      case "Free":
        return sortFeatured(packages.filter((pkg) => pkg.price.trim().toLowerCase() === "free"));
      case "Paid":
        return sortFeatured(packages.filter((pkg) => pkg.price.trim().toLowerCase() !== "free"));
      case "Featured":
      default:
        return sortFeatured(packages);
    }
  }, [activeTab, packages]);

  return (
    <div className="container py-8 space-y-6">
      <PageHeader
        eyebrow="THE REGISTRY FOR AGENT-READY PACKAGES"
        title="Discover"
        subtitle="Browse packages, prompts, datasets, tools, and agent-ready assets."
      />

      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            placeholder="Search packages, package ids, or publishers..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                const nextQuery = searchValue.trim();
                navigate(nextQuery ? `/search?q=${encodeURIComponent(nextQuery)}` : "/search");
              }
            }}
            className="w-full h-10 rounded-md border bg-secondary/30 pl-10 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 h-10 rounded-md border px-4 text-sm hover:bg-secondary transition-colors"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filters
        </button>
      </div>

      {showFilters && (
        <div className="flex flex-wrap gap-2 p-4 rounded-md border bg-card">
          {discoverFilters.map((f) => (
            <button
              key={f}
              className="h-7 rounded-md border px-3 text-xs hover:bg-secondary transition-colors"
            >
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto border-b">
        {discoverTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab
                ? "border-accent text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div>
        {isLoading && visiblePackages.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <PackageCardSkeleton key={index} />
            ))}
          </div>
        ) : visiblePackages.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiblePackages.map((pkg) => (
              <PackageCard key={pkg.id} package={pkg} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            No packages matched this discover view yet.
          </div>
        )}
      </div>
    </div>
  );
}
