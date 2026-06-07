# PrimeGate — Visual / UX Polish (Track A)

**Date:** 2026-06-07
**Status:** Approved design, pending implementation plan
**Scope:** Whole app — all public surfaces + the authed Workspace.

This is **Track A** of a four-track "make PrimeGate sophisticated" effort. The other tracks (B: deeper features, C: technical hardening, D: AI-native) are out of scope here and get their own spec → plan → build cycles. This track changes **look, feel, motion, and front-end information architecture only** — no API contracts, data models, or auth flows change.

---

## 1. Goal

Move PrimeGate from generic shadcn defaults to a distinctive, premium **"warm editorial"** design language that reads as serious, trustworthy registry infrastructure — without losing the speed and density a package-browsing product needs.

Success criteria:
- Every public and workspace surface uses the new design language consistently.
- Light **and** dark modes are both first-class and polished.
- Motion is tasteful and subtle, never flashy or janky.
- No regression in functionality, routing, or data flow — this is a reskin + IA refinement, not a rewrite.

---

## 2. Design Language (locked via visual brainstorming)

**Direction:** B — Warm editorial (evolves the existing sand/gold identity rather than replacing it).
**Treatment:** B2 — "Editorial-tech": serif reserved for big moments; crisp sans + tabular numbers for all UI and data. Editorial soul, product speed.

### 2.1 Typography
- **Display / titles (serif):** **Spectral** — used for hero headlines, page titles, package names, publisher names.
- **UI / body (sans):** **Inter** — nav, buttons, descriptions, metadata, forms, tables.
- **Numbers:** always `font-variant-numeric: tabular-nums` for counts, versions, prices, ratings, dates.
- **Eyebrows / labels:** Inter, ~11px, `letter-spacing: .12em`, uppercase, gold.
- Fonts loaded self-hosted via the build (preferred) or `@fontsource`, not a render-blocking Google CDN link. Define a typographic scale in Tailwind (display / h1–h4 / body / small / label).

### 2.2 Color (refined sand/gold palette)
Refine the existing HSL tokens in `src/index.css` toward these anchors (exact HSL values finalized in implementation, but the targets are):

**Light:**
- Background `#f7f3ea` (warm sand) · raised surface `#fbf8f1` · card `#ffffff`/`#fffdf8`
- Text `#2b2620` · muted `#8a7e68`
- Gold accent (primary) `#9a7b3f` · accent-hover slightly darker
- Border `#e6dcc6` / hairline `#ece2cf` · tag bg `#efe7d6` on tag text `#8a7140`

**Dark (first-class, warm — NOT a cold invert):**
- Background `#17140f` · raised `#201b13` · card `#201b13`
- Text `#ece3d2`/`#f3ead7` · muted `#9c917b`
- Gold accent `#d8b878` / `#caa765` · border `#322a1d` / hairline `#2c2418` · tag bg `#3a3020`

All colors remain CSS variables in `:root` and `.dark` so the toggle stays a class swap. Verify WCAG AA contrast for text and interactive elements in both modes.

### 2.3 Shape, spacing, elevation
- Radius scale: cards `~12px`, inputs/buttons `~8–10px`, pills/chips `999px`.
- Generous but efficient spacing; cards use hairline borders + very soft shadow rather than heavy elevation.
- Consistent 4/8px spacing rhythm via Tailwind scale.

### 2.4 Motion (tasteful & subtle — adds `framer-motion`)
- Card hover: subtle lift + border warm-up.
- Page / route transitions: short fade/slide (respect `prefers-reduced-motion`).
- Section reveal on scroll for landing only (not in dense grids).
- Skeleton loaders for async lists/detail instead of spinners.
- Micro-interactions on buttons, tabs, toggles.
- Hard rule: all motion disabled/reduced under `prefers-reduced-motion: reduce`.

---

## 3. Core Reusable Components (build/refine first)

These propagate everywhere, so they're built once and reused:

1. **PackageCard** — serif title, version pill, `@publisher · license`, one-line description, hairline footer with `installs · ★ rating` (tabular) and an Install/Buy action. Free vs paid variant. Hover lift.
2. **AppShell / PublicNav** — editorial wordmark (Spectral), nav links, dark-mode toggle, Connect Wallet. Sticky, hairline bottom border, raised surface.
3. **WorkspaceLayout / Sidebar** — warm dark sidebar (already token-driven), refined active state, now including the **Publish** entry (see §5).
4. **SearchBar + FilterChips** — pill chips with gold active state.
5. **PageHeader** — eyebrow + Spectral title + optional subtitle/actions, used on every page.
6. **Stat / metric tiles** (recharts theming for publisher dashboards) — tabular numbers, gold series color.
7. **EmptyState**, **Skeleton**, **Toast/Alert**, **Badge/Tag** — themed to the palette.

The shadcn primitives stay; theming flows through tokens + a thin set of these composed components.

---

## 4. Per-Surface Polish Plan

**Public:**
- **Landing** — editorial hero (eyebrow + Spectral headline + search), featured/trending package strip, "how it works" teaser, scroll-reveal motion.
- **Discover** — hero + search + filter chips + responsive 3-up (→ 2 → 1) PackageCard grid; skeletons while loading. *(Validated as the reference full-page mockup.)*
- **Search** — results grid reusing PackageCard, result count (tabular), refine filters.
- **Categories** — editorial category tiles.
- **Package detail** (`/package/:id` + tabs: Overview / Versions / Install / Usage / Reviews / Publisher) — strong header (Spectral name, publisher, version, install/buy), tabbed content with consistent rhythm; code/install blocks styled; reviews and version history readable.
- **Publisher profile** — identity header, package grid, stats.
- **Docs / How-it-works** — long-form editorial typography, good measure (line length), anchored sections.

**Workspace (authed):**
- WorkspaceExplore, Installed, Purchases, **Publishing** dashboard (packages / releases / sales), Wallet — refined cards, tables with tabular numbers, recharts theming on sales/analytics, empty states.

---

## 5. Information Architecture Change: Publish → Workspace

**Decision:** Publishing is an authenticated action and belongs with the user's authed surfaces.

- **Remove** `Publish` from the public top nav.
- The current public `/publish` route becomes an **entry CTA** ("Publish a package") on Landing / appropriate public spots that routes into the workspace publish flow; if the wallet isn't connected, it prompts Connect Wallet first.
- The actual publish flow lives in the **Workspace** alongside Installed / Purchases / Publishing / Wallet (e.g. `/workspace/publishing` and its sub-routes, with a clear "New release / Publish" action in the workspace sidebar).
- Existing route paths/data flow are preserved where possible; this is a navigation/placement change, not a flow rewrite. Redirect `/publish` → workspace publish entry (with connect gate) so old links don't break.

---

## 6. Constraints & Non-Goals

- **No backend/API/data-model/auth changes.** Reskin + front-end IA only.
- **No new features** (search semantics, analytics depth, etc. belong to Track B).
- Keep all existing routes working (redirects where IA moves things).
- Stay within the current stack: React 18, Vite 5, Tailwind 3, shadcn/Radix, TanStack Query. Only new dependency: `framer-motion` (+ a font package).
- Accessibility: AA contrast both themes, focus-visible states, `prefers-reduced-motion` honored.

---

## 7. Suggested Implementation Order

1. **Foundations:** Tailwind theme + `index.css` tokens (light + dark), typography scale, font loading, motion primitives + reduced-motion guard.
2. **Core components:** PackageCard, PageHeader, SearchBar/FilterChips, AppShell/PublicNav, EmptyState/Skeleton/Tag.
3. **Public surfaces:** Landing → Discover → Search/Categories → Package detail (+ tabs) → Publisher → Docs/How-it-works.
4. **IA change:** move Publish into Workspace + redirect.
5. **Workspace surfaces:** layout/sidebar → dashboards (with recharts theming) → wallet.
6. **Polish pass:** dark-mode audit, contrast/a11y check, reduced-motion check, responsive check.

Each step should keep the app runnable and visually consistent as it lands.
