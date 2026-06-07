# Visual Polish — Plan 4: Search + Docs + How-it-works

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the remaining public pages — Search, Docs, How-it-works — into the editorial language: PageHeader title blocks, gold (`primary`) accents instead of the old `accent`, serif section titles, and rounded-xl surfaces.

**Architecture:** Pure presentational reskin. No changes to search ranking, data hooks, code snippets, or routing. The dominant change across all three is swapping `text-accent` → `text-primary` and replacing the bespoke header blocks with the shared `PageHeader`. Borders already pick up the themed color via the global `* { @apply border-border }` rule in `index.css`.

**Tech Stack:** React 18, Tailwind 3, lucide-react. Tests: vitest + @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-06-07-visual-ux-polish-design.md`
**Builds on:** Plans 1–3.

---

## File Structure

- Modify: `src/pages/Search.tsx`
- Modify: `src/pages/Docs.tsx`
- Modify: `src/pages/HowItWorks.tsx`

---

## Task 1: Reskin Search

**Files:**
- Modify: `src/pages/Search.tsx`

- [ ] **Step 1: Add the PageHeader import**

Add alongside the existing imports:
```tsx
import { PageHeader } from "@/components/layout/PageHeader";
```

- [ ] **Step 2: Replace the header block**

Replace:
```tsx
      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">Registry Search</p>
        <h1 className="text-3xl font-bold tracking-tight">Search packages, publishers, and capabilities</h1>
        <p className="text-sm text-muted-foreground">
          Search is public. Users only need to sign in when they want to purchase or install.
        </p>
      </div>
```
with:
```tsx
      <PageHeader
        eyebrow="REGISTRY SEARCH"
        title="Search packages, publishers, and capabilities"
        subtitle="Search is public. Users only need to sign in when they want to purchase or install."
      />
```

- [ ] **Step 3: Swap accent → primary across the file**

Replace **all** occurrences of `text-accent` with `text-primary` in `src/pages/Search.tsx` (the three section-heading icons and the suggested-scopes Sparkles icon).

- [ ] **Step 4: Make result labels serif and the action gold**

There are three near-identical result rows (Top Matches, Publisher Results, Catalog Results). In each, the label is rendered as `<p className="text-sm font-medium">{...}</p>` and the trailing action is `<span className="text-xs text-muted-foreground">Open</span>`.

4a. Replace **all** occurrences of:
```tsx
                  <p className="text-sm font-medium">{match.label}</p>
```
with:
```tsx
                  <p className="font-serif text-base font-semibold">{match.label}</p>
```

4b. Replace **all** occurrences of the publisher/package label form `<p className="text-sm font-medium">{publisher.id}</p>` and `<p className="text-sm font-medium">{pkg.name}</p>` with the serif form (`font-serif text-base font-semibold`, same expression inside).

4c. Replace **all** three occurrences of:
```tsx
                    <span className="text-xs text-muted-foreground">Open</span>
```
with:
```tsx
                    <span className="text-xs font-semibold text-primary">Open →</span>
```

- [ ] **Step 5: Verify build + tests**

Run: `pnpm build` → succeeds (no unused-import errors).
Run: `pnpm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Search.tsx
git commit -m "feat: editorial reskin of Search (PageHeader, gold accents, serif results)"
```

---

## Task 2: Reskin Docs

**Files:**
- Modify: `src/pages/Docs.tsx`

- [ ] **Step 1: Add the PageHeader import**

```tsx
import { PageHeader } from "@/components/layout/PageHeader";
```

- [ ] **Step 2: Replace the header block**

Replace:
```tsx
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          PrimeGate exposes a single canonical flow for search, resolve, manifests, and downloads. Use this flow
          across web, CLI, SDK, and MCP so clients never bypass PrimeGate for Shelby data.
        </p>
      </div>
```
with:
```tsx
      <PageHeader
        eyebrow="DOCUMENTATION"
        title="Documentation"
        subtitle="PrimeGate exposes a single canonical flow for search, resolve, manifests, and downloads — across web, CLI, SDK, and MCP."
      />
```

- [ ] **Step 3: Swap accent → primary**

Replace **all** occurrences of `text-accent` with `text-primary` in `src/pages/Docs.tsx`.

- [ ] **Step 4: Make the section card titles serif**

Replace **all** occurrences of `<h3 className="font-semibold` with `<h3 className="font-serif text-base font-semibold` in `src/pages/Docs.tsx`. (If a match already includes more classes after `font-semibold`, keep them — only the prefix changes.)

- [ ] **Step 5: Verify**

Run: `pnpm build` → succeeds.
Run: `pnpm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Docs.tsx
git commit -m "feat: editorial reskin of Docs"
```

---

## Task 3: Reskin How-it-works

**Files:**
- Modify: `src/pages/HowItWorks.tsx`

- [ ] **Step 1: Add the PageHeader import**

```tsx
import { PageHeader } from "@/components/layout/PageHeader";
```

- [ ] **Step 2: Replace the header block**

Replace:
```tsx
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-bold">How It Works</h1>
        <p className="text-sm text-muted-foreground">
          PrimeGate is the registry and access layer. Shelby is the storage layer underneath it.
        </p>
      </div>
```
with:
```tsx
      <PageHeader
        eyebrow="HOW IT WORKS"
        title="How It Works"
        subtitle="PrimeGate is the registry and access layer. Shelby is the storage layer underneath it."
      />
```

- [ ] **Step 3: Refine the section cards**

Replace:
```tsx
          <div key={section.title} className="rounded-lg border p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.desc}</p>
            </div>
```
with:
```tsx
          <div
            key={section.title}
            className="space-y-4 rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <div className="space-y-1">
              <h3 className="font-serif text-lg font-semibold">{section.title}</h3>
              <p className="text-xs text-muted-foreground">{section.desc}</p>
            </div>
```

- [ ] **Step 4: Swap accent → primary**

Replace **all** occurrences of `text-accent` with `text-primary` in `src/pages/HowItWorks.tsx` (the `Check` icon).

- [ ] **Step 5: Verify**

Run: `pnpm build` → succeeds.
Run: `pnpm test` → all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/HowItWorks.tsx
git commit -m "feat: editorial reskin of How-it-works"
```

---

## Task 4: Full verification

- [ ] **Step 1: Test suite** — `pnpm test` → all pass.
- [ ] **Step 2: Lint** — `pnpm lint` → no new errors in the three pages.
- [ ] **Step 3: Build** — `pnpm build` → succeeds.
- [ ] **Step 4: Boot smoke** — `pnpm dev`; confirm `/search`, `/docs`, `/how-it-works` each serve 200.
- [ ] **Step 5: Final commit if needed** — `git add -A && git commit -m "chore: plan 4 verification fixes" || echo "nothing to commit"`

---

## Done criteria

- Search, Docs, How-it-works all use PageHeader, gold (`primary`) accents, serif section titles, and themed surfaces.
- No behavioral change to search ranking, snippets, or routing.
- All tests pass; build clean.
