import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Package, Search, Sparkles, UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrimeGateCatalogSearch, usePrimeGatePublisherSearch } from "@/hooks/usePrimeGateCatalog";
import { formatPrimeGatePackageTypeLabel } from "@/lib/primegate-package-type";
import { suggestedScopes } from "@/lib/registry-data";

type TopMatch = {
  description: string;
  id: string;
  kind: "package" | "publisher";
  label: string;
  meta: string;
  score: number;
  to: string;
};

function scoreSearchValue(query: string, ...values: string[]) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return 0;
  }

  let score = 0;

  for (const value of values) {
    const normalizedValue = value.toLowerCase();

    if (normalizedValue === normalizedQuery) {
      score += 120;
      continue;
    }

    if (normalizedValue.startsWith(normalizedQuery)) {
      score += 80;
      continue;
    }

    if (normalizedValue.includes(normalizedQuery)) {
      score += 40;
    }
  }

  return score;
}

function SearchResultSkeleton() {
  return (
    <div className="rounded-lg border px-4 py-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query.trim());
  const { data: packageResults = [], isLoading: packagesLoading } = usePrimeGateCatalogSearch(deferredQuery);
  const { data: publisherResults = [], isLoading: publishersLoading } = usePrimeGatePublisherSearch(deferredQuery);

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  const hasQuery = deferredQuery.length > 0;
  const isLoading = packagesLoading || publishersLoading;
  const topMatches = useMemo(() => {
    if (!hasQuery) {
      return [] as TopMatch[];
    }

    const packageMatches = packageResults.map((pkg) => ({
      description: pkg.description,
      id: pkg.id,
      kind: "package" as const,
      label: pkg.name,
      meta: pkg.packageHandle
        ? `${pkg.packageHandle} | ${pkg.price}`
        : `${pkg.publisher} | ${pkg.price}`,
      score:
        scoreSearchValue(deferredQuery, pkg.name) * 3 +
        scoreSearchValue(deferredQuery, pkg.id, pkg.packageHandle ?? "", pkg.packageSlug ?? "") * 3 +
        scoreSearchValue(deferredQuery, pkg.publisher) * 2 +
        scoreSearchValue(deferredQuery, pkg.description, pkg.type),
      to: `/package/${pkg.id}`,
    }));

    const publisherMatches = publisherResults.map((publisher) => ({
      description: publisher.summary,
      id: publisher.id,
      kind: "publisher" as const,
      label: publisher.id,
      meta: `${publisher.packageCount} packages | Member since ${publisher.memberSince}`,
      score:
        scoreSearchValue(deferredQuery, publisher.id) * 3 +
        scoreSearchValue(deferredQuery, publisher.summary),
      to: `/publisher/${publisher.id}`,
    }));

    return [...packageMatches, ...publisherMatches]
      .sort((left, right) => right.score - left.score || left.label.localeCompare(right.label))
      .slice(0, 6);
  }, [deferredQuery, hasQuery, packageResults, publisherResults]);

  const applyQuery = (nextQuery: string) => {
    const trimmed = nextQuery.trim();
    setSearchParams(trimmed ? { q: trimmed } : {});
  };

  return (
    <div className="container max-w-4xl py-8 space-y-8">
      <PageHeader
        eyebrow="REGISTRY SEARCH"
        title="Search packages, publishers, and capabilities"
        subtitle="Search is public. Users only need to sign in when they want to purchase or install."
      />

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          placeholder="Search by package name, package id, or publisher..."
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            applyQuery(nextQuery);
          }}
          className="h-12 w-full rounded-xl border bg-secondary/30 pl-11 pr-4 text-sm outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.3fr)_minmax(240px,0.7fr)]">
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Top Matches</h2>
            </div>
            <div className="space-y-1">
              {!hasQuery ? (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  Start typing to see the strongest PrimeGate matches across packages and publishers.
                </div>
              ) : isLoading ? (
                <div className="space-y-2">
                  <SearchResultSkeleton />
                  <SearchResultSkeleton />
                </div>
              ) : topMatches.length > 0 ? (
                topMatches.map((match) => (
                  <Link
                    key={`${match.kind}:${match.id}`}
                    to={match.to}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-serif text-base font-semibold">{match.label}</p>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {match.kind}
                        </span>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{match.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{match.meta}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Open →</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  No PrimeGate matches ranked for &quot;{query}&quot;.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Publisher Results</h2>
            </div>
            <div className="space-y-1">
              {!hasQuery ? (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  Search PrimeGate for publishers who have listed artifacts before.
                </div>
              ) : isLoading ? (
                <div className="space-y-2">
                  <SearchResultSkeleton />
                  <SearchResultSkeleton />
                </div>
              ) : publisherResults.length > 0 ? (
                publisherResults.map((publisher) => (
                  <Link
                    key={publisher.id}
                    to={`/publisher/${publisher.id}`}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-serif text-base font-semibold">{publisher.id}</p>
                        {publisher.verified && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Verified
                          </span>
                        )}
                        {!publisher.verified && publisher.id.startsWith("0x") && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Wallet Publisher
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{publisher.summary}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {publisher.packageCount} packages | Member since {publisher.memberSince}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Open →</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  No publishers matched &quot;{query}&quot;.
                </div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Catalog Results</h2>
            </div>
            <div className="space-y-1">
              {!hasQuery ? (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  Search PrimeGate for packages, prompts, datasets, and published artifacts.
                </div>
              ) : isLoading ? (
                <div className="space-y-2">
                  <SearchResultSkeleton />
                  <SearchResultSkeleton />
                  <SearchResultSkeleton />
                </div>
              ) : packageResults.length > 0 ? (
                packageResults.map((pkg) => (
                  <Link
                    key={pkg.id}
                    to={`/package/${pkg.id}`}
                    className="flex items-center justify-between rounded-lg border px-4 py-3 transition-colors hover:bg-secondary/30"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-serif text-base font-semibold">{pkg.name}</p>
                        <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {formatPrimeGatePackageTypeLabel(pkg.type)}
                        </span>
                        {pkg.publisher.startsWith("0x") && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Published
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{pkg.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {pkg.packageHandle ?? pkg.publisher} | {pkg.price}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-primary">Open →</span>
                  </Link>
                ))
              ) : (
                <div className="rounded-lg border px-4 py-6 text-sm text-muted-foreground">
                  No PrimeGate catalog entries matched &quot;{query}&quot;.
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">Suggested scopes</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedScopes.map((term) => (
              <button
                key={term}
                type="button"
                onClick={() => {
                  setQuery(term);
                  applyQuery(term);
                }}
                className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {term}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Catalog results are alphabetized by package name. Top matches stay ranked by closeness to the query.
          </p>
        </aside>
      </div>
    </div>
  );
}
