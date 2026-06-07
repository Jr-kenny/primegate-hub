# Visual Polish — Plan 7: Final Polish Audit

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Close out the visual track: add a `prefers-reduced-motion` guard for the CSS animations, and bring the two remaining public detail surfaces (PackageDetail, PublisherProfile) into the editorial language with serif titles.

**Audit results (already verified):** No hardcoded light-only colors in our pages/components — dark mode is safe. `text-accent` usages on detail pages map to the gold token and render correctly in both themes (no fix required for correctness). Grids already responsive (1/2/3 col).

**Builds on:** Plans 1–6.

---

## Task 1: Reduced-motion guard for CSS animations

**Files:** Modify `src/index.css`

The global `MotionConfig reducedMotion="user"` covers framer-motion, but the CSS `pg-fade-up` / `pg-shimmer` animations are not covered. Add a guard.

- [ ] **Step 1:** Append to the end of `src/index.css`:
```css
@media (prefers-reduced-motion: reduce) {
  .pg-fade-up,
  .pg-skeleton::after {
    animation: none !important;
  }
  * {
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2:** `pnpm build` → succeeds. Commit:
```bash
git add src/index.css
git commit -m "a11y: honor prefers-reduced-motion for CSS animations"
```

---

## Task 2: Serif titles on detail pages

**Files:** Modify `src/pages/PackageDetail.tsx`, `src/pages/PublisherProfile.tsx`

- [ ] **Step 1:** In `PackageDetail.tsx`, replace `<h1 className="text-xl font-bold font-mono">{pkg.name}</h1>` with:
```tsx
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{pkg.name}</h1>
```

- [ ] **Step 2:** In `PublisherProfile.tsx`, replace `<h1 className="text-xl font-bold">{publisherProfile.id}</h1>` with:
```tsx
            <h1 className="font-serif text-2xl font-semibold tracking-tight">{publisherProfile.id}</h1>
```

- [ ] **Step 3:** `pnpm build` → succeeds; `pnpm test` → all pass. Commit:
```bash
git add src/pages/PackageDetail.tsx src/pages/PublisherProfile.tsx
git commit -m "feat: serif titles on package and publisher detail pages"
```

---

## Task 3: Final full verification

- [ ] `pnpm test` → all pass.
- [ ] `pnpm lint` → 0 errors.
- [ ] `pnpm build` → succeeds.
- [ ] `pnpm dev`; spot-check a few routes serve 200.

## Done criteria
- Reduced-motion honored across framer-motion AND CSS animations.
- PackageDetail + PublisherProfile use serif titles.
- Whole visual track (Plans 1–7) complete; all green.
