# Visual Polish — Plan 2: Public Nav + Discover

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the public top nav to the editorial language (serif wordmark, refined links, theme toggle, Publish removed from public nav) and rebuild the Discover page as a responsive `PackageCard` grid with a skeleton loading state.

**Architecture:** Compose the Plan 1 building blocks (`PageHeader`, `PackageCard`, `ThemeToggle`) into the existing `PublicNav` and `Discover` page. Add one new small component, `PackageCardSkeleton`, for loading states. No data-fetching or routing logic changes — `usePrimeGateWallet` / `useDiscoverPackages` stay as-is. Publishing stays reachable by route in this plan; the full Publish→Workspace IA move (redirect + placement) is a later plan.

**Tech Stack:** React 18, Tailwind 3, framer-motion, lucide-react. Tests: vitest + jsdom + @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-06-07-visual-ux-polish-design.md`
**Builds on:** Plan 1 (`docs/superpowers/plans/2026-06-07-visual-polish-01-foundations.md`)

---

## File Structure

- Create: `src/components/package/PackageCardSkeleton.tsx` — loading placeholder matching PackageCard
- Modify: `src/components/PublicNav.tsx` — serif wordmark, drop Publish nav item, add ThemeToggle
- Modify: `src/pages/Discover.tsx` — PageHeader + PackageCard grid + skeletons

---

## Task 1: PackageCardSkeleton

**Files:**
- Create: `src/components/package/PackageCardSkeleton.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/package/PackageCardSkeleton.tsx`:
```tsx
import { cn } from "@/lib/utils";

export function PackageCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}
      aria-hidden="true"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="h-5 w-2/3 rounded bg-muted pg-skeleton" />
        <div className="h-4 w-10 rounded bg-muted pg-skeleton" />
      </div>
      <div className="mt-2 h-3 w-1/3 rounded bg-muted pg-skeleton" />
      <div className="mt-3 h-3 w-full rounded bg-muted pg-skeleton" />
      <div className="mt-1.5 h-3 w-4/5 rounded bg-muted pg-skeleton" />
      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <div className="h-3 w-20 rounded bg-muted pg-skeleton" />
        <div className="h-3 w-14 rounded bg-muted pg-skeleton" />
      </div>
    </div>
  );
}
```
(`pg-skeleton` is an existing shimmer utility in `src/index.css`.)

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/package/PackageCardSkeleton.tsx
git commit -m "feat: add PackageCardSkeleton loading placeholder"
```

---

## Task 2: Reskin PublicNav (TDD for the behavioral changes)

**Files:**
- Modify: `src/components/PublicNav.tsx`
- Create: `src/components/PublicNav.test.tsx`

The behavioral/structural changes worth testing: (a) "Publish" is no longer in the public nav, (b) a theme toggle is present. Visual classes are not unit-tested.

- [ ] **Step 1: Write the failing test**

Create `src/components/PublicNav.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-themes", () => ({ useTheme: () => ({ theme: "light", setTheme: vi.fn() }) }));
vi.mock("@/hooks/usePrimeGateWallet", () => ({
  usePrimeGateWallet: () => ({
    address: null,
    availableWallets: [],
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: false,
    isReconnectingWallet: false,
    shortAddress: null,
  }),
}));

import { PublicNav } from "./PublicNav";

function renderNav() {
  return render(
    <MemoryRouter>
      <PublicNav />
    </MemoryRouter>,
  );
}

describe("PublicNav", () => {
  it("does not show Publish in the public nav", () => {
    renderNav();
    expect(screen.queryByRole("link", { name: "Publish" })).not.toBeInTheDocument();
  });

  it("renders a theme toggle", () => {
    renderNav();
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });

  it("keeps core discovery links", () => {
    renderNav();
    expect(screen.getByRole("link", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Categories" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/PublicNav.test.tsx`
Expected: FAIL — "Publish" link still present and/or no toggle button.

- [ ] **Step 3: Apply the nav changes**

In `src/components/PublicNav.tsx`:

3a. Add the toggle import near the other imports:
```tsx
import { ThemeToggle } from "@/components/theme/ThemeToggle";
```

3b. Remove the Publish entry from `navItems` so it reads:
```tsx
const navItems = [
  { label: "Discover", path: "/discover" },
  { label: "Search", path: "/search" },
  { label: "Categories", path: "/categories" },
  { label: "Docs", path: "/docs" },
  { label: "How It Works", path: "/how-it-works" },
];
```

3c. Replace the wordmark `<Link to="/" ...>` block with the serif editorial wordmark:
```tsx
        <Link
          to="/"
          className="flex shrink-0 items-center gap-2 font-serif text-xl font-semibold tracking-tight"
        >
          <span className="text-primary">◈</span> PrimeGate
        </Link>
```

3d. In the right-hand controls `<div className="flex items-center gap-2">`, add `<ThemeToggle />` as the first child (before the search link):
```tsx
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            to="/search"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/PublicNav.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/PublicNav.tsx src/components/PublicNav.test.tsx
git commit -m "feat: editorial nav wordmark + theme toggle, drop Publish from public nav"
```

---

## Task 3: Rebuild Discover as an editorial card grid

**Files:**
- Modify: `src/pages/Discover.tsx`

Replace the header, and replace the inline list-row rendering with a responsive `PackageCard` grid + skeletons. Keep all existing state/sorting/tab logic (`activeTab`, `visiblePackages`, `useDiscoverPackages`, search navigate-on-enter, filters toggle) unchanged.

- [ ] **Step 1: Update imports at the top of `src/pages/Discover.tsx`**

Add these imports alongside the existing ones:
```tsx
import { PageHeader } from "@/components/layout/PageHeader";
import { PackageCard } from "@/components/package/PackageCard";
import { PackageCardSkeleton } from "@/components/package/PackageCardSkeleton";
```
The existing `Link` import from `react-router-dom` and `formatPrimeGatePackageTypeLabel` import are no longer used after this task — remove `Link` from the `react-router-dom` import (keep `useNavigate`) and remove the `formatPrimeGatePackageTypeLabel` import line to avoid lint errors.

- [ ] **Step 2: Replace the header block**

Replace:
```tsx
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Discover</h1>
        <p className="text-sm text-muted-foreground">Browse packages, prompts, datasets, tools, and agent-ready assets.</p>
      </div>
```
with:
```tsx
      <PageHeader
        eyebrow="THE REGISTRY FOR AGENT-READY PACKAGES"
        title="Discover"
        subtitle="Browse packages, prompts, datasets, tools, and agent-ready assets."
      />
```

- [ ] **Step 3: Replace the results block**

Replace the entire results `<div className="space-y-1"> ... </div>` block (the one containing the `isLoading` ternary and the inline `<Link>` rows) with:
```tsx
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
```

- [ ] **Step 4: Verify the page compiles and existing tests still pass**

Run: `pnpm build`
Expected: build succeeds, no "unused variable" / "Link is not defined" errors.
Run: `pnpm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Discover.tsx
git commit -m "feat: rebuild Discover as editorial PackageCard grid with skeletons"
```

---

## Task 4: Full verification

- [ ] **Step 1: Test suite**

Run: `pnpm test`
Expected: all pass (Plan 1 tests + PublicNav's 3 new tests).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors in `PublicNav.tsx`, `Discover.tsx`, `PackageCardSkeleton.tsx`. Fix any unused-import errors introduced.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: succeeds.

- [ ] **Step 4: Boot smoke test**

Run `pnpm dev`, confirm `http://localhost:8080/discover` serves (HTTP 200) and the nav shows the serif wordmark + theme toggle and no Publish link.

- [ ] **Step 5: Final commit if needed**

```bash
git add -A && git commit -m "chore: plan 2 verification fixes" || echo "nothing to commit"
```

---

## Done criteria

- Public nav uses the serif editorial wordmark, has a working light/dark toggle, and no longer lists Publish.
- Discover renders a responsive 1/2/3-column `PackageCard` grid with skeleton loaders and a themed empty state.
- All tests pass; build clean.
