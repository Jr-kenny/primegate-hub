# Visual Polish — Plan 6: Workspace surfaces

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Bring the authed Workspace into the editorial language: fix the sidebar wordmark (serif, repair the mojibake glyph), give the connect-gate screen a serif title, and convert the workspace page headers to serif.

**Architecture:** Presentational only. Sidebar colors already come from the warm dark sidebar tokens refined in Plan 1. No data/routing changes.

**Builds on:** Plans 1–5.

---

## Task 1: Sidebar wordmark

**Files:** Modify `src/components/WorkspaceSidebar.tsx`

- [ ] **Step 1:** Replace the wordmark Link:
```tsx
          <Link to="/" className="flex items-center gap-2 font-semibold text-sm">
            <span className="text-sidebar-primary">âŒ˜</span> PrimeGate
          </Link>
```
with:
```tsx
          <Link to="/" className="flex items-center gap-2 font-serif text-base font-semibold">
            <span className="text-sidebar-primary">◈</span> PrimeGate
          </Link>
```

- [ ] **Step 2:** `pnpm build` → succeeds. Commit:
```bash
git add src/components/WorkspaceSidebar.tsx
git commit -m "feat: editorial serif workspace wordmark (fix mojibake glyph)"
```

---

## Task 2: Connect-gate title

**Files:** Modify `src/components/WorkspaceLayout.tsx`

- [ ] **Step 1:** Replace `<h1 className="mt-4 text-3xl font-semibold tracking-tight">Connect Wallet</h1>` with:
```tsx
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">Connect Wallet</h1>
```

- [ ] **Step 2:** `pnpm build` → succeeds. Commit:
```bash
git add src/components/WorkspaceLayout.tsx
git commit -m "feat: serif connect-gate title"
```

---

## Task 3: Serif workspace page headers

**Files:** Modify `src/pages/workspace/Installed.tsx`, `Purchases.tsx`, `Publishing.tsx`, `PublisherPackages.tsx`, `PublisherReleases.tsx`, `PublisherSales.tsx`

- [ ] **Step 1:** In each file, replace the page-title heading `<h1 className="text-2xl font-bold">` with `<h1 className="font-serif text-3xl font-semibold tracking-tight">`. (Only the `<h1>`; leave any stat `<p className="text-2xl font-bold">` untouched.)

- [ ] **Step 2:** `pnpm build` → succeeds; `pnpm test` → all pass. Commit:
```bash
git add src/pages/workspace
git commit -m "feat: serif headers across workspace pages"
```

---

## Task 4: Verify
- [ ] `pnpm test` → pass; `pnpm lint` → no new errors; `pnpm build` → succeeds.

## Done criteria
- Workspace sidebar + connect screen + page headers all read in the editorial language; warm dark sidebar intact.
