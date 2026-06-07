# Visual Polish — Plan 3: Landing + Categories

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin the Landing page (editorial hero with a tasteful reveal, refined feature cards + quick-install block) and the Categories page (PageHeader + refined category tiles) to the warm-editorial language.

**Architecture:** Hand-crafted editorial hero on Landing (Spectral headline, gold eyebrow, primary CTA) wrapped in a framer-motion reveal that respects the global `reducedMotion="user"`. Categories reuses `PageHeader` and restyles its tiles. No data/routing changes — Categories keeps `useDiscoverPackages` + counts logic.

**Tech Stack:** React 18, Tailwind 3, framer-motion, lucide-react. Tests: vitest + @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-06-07-visual-ux-polish-design.md`
**Builds on:** Plans 1–2.

---

## File Structure

- Modify: `src/pages/Landing.tsx` — editorial hero + reveal + refined cards
- Create: `src/pages/Landing.test.tsx` — smoke test for key content
- Modify: `src/pages/Categories.tsx` — PageHeader + refined tiles

---

## Task 1: Reskin Landing (TDD smoke)

**Files:**
- Create: `src/pages/Landing.test.tsx`
- Modify: `src/pages/Landing.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/Landing.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import Landing from "./Landing";

describe("Landing", () => {
  it("renders the hero headline and primary CTAs", () => {
    render(
      <MemoryRouter>
        <Landing />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Browse Registry/i })).toHaveAttribute("href", "/discover");
    expect(screen.getByRole("link", { name: /Read the Docs/i })).toHaveAttribute("href", "/docs");
  });
});
```

- [ ] **Step 2: Run test to verify it passes against current page**

Run: `pnpm test src/pages/Landing.test.tsx`
Expected: PASS (the current Landing already has these links/heading). This test is a regression guard for the reskin in Step 3.

- [ ] **Step 3: Replace the Landing component body**

Replace the entire contents of `src/pages/Landing.tsx` with:
```tsx
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Terminal, Package, Zap, Globe } from "lucide-react";

const features = [
  {
    icon: Package,
    title: "Packages & Artifacts",
    desc: "Tools, prompts, datasets, workflows, and agent components — versioned, entitlement-gated, and installable.",
  },
  {
    icon: Zap,
    title: "Agent-Native",
    desc: "Every asset is addressable by agents via MCP, CLI, and SDK. The browser is one surface, not the only one.",
  },
  {
    icon: Globe,
    title: "Wallet-Native Commerce",
    desc: "Connect your wallet. Purchase, license, and entitle assets with on-chain settlement. No accounts required.",
  },
];

export default function Landing() {
  return (
    <div className="container max-w-5xl space-y-20 py-20">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="space-y-6"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">
          The registry for agent-ready packages
        </p>
        <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-[1.08] tracking-tight md:text-6xl">
          Discover, install, and trust every package.
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">
          PrimeGate is a wallet-native registry and commerce layer. Discover, install, publish, and transact
          across CLI, SDK, MCP, and web — from one canonical source.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            to="/discover"
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse Registry <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/docs"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            <Terminal className="h-4 w-4" /> Read the Docs
          </Link>
        </div>
      </motion.section>

      <section className="grid gap-5 md:grid-cols-3">
        {features.map((item) => (
          <div
            key={item.title}
            className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm transition-colors hover:border-primary/40"
          >
            <item.icon className="h-5 w-5 text-primary" />
            <h3 className="font-serif text-lg font-semibold">{item.title}</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-card p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">Quick Install</p>
        <div className="rounded-lg bg-secondary p-4 font-mono text-sm text-foreground">
          <span className="text-muted-foreground">$</span> primegate install @scope/package-name
        </div>
        <p className="text-xs text-muted-foreground">
          Works with npm, pip, cargo, and MCP-compatible agent runtimes.
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it still passes**

Run: `pnpm test src/pages/Landing.test.tsx`
Expected: PASS — headline (h1) present, both CTA links intact.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Landing.tsx src/pages/Landing.test.tsx
git commit -m "feat: editorial Landing hero with reveal and refined cards"
```

---

## Task 2: Reskin Categories

**Files:**
- Modify: `src/pages/Categories.tsx`

- [ ] **Step 1: Add the PageHeader import**

In `src/pages/Categories.tsx`, add to the imports:
```tsx
import { PageHeader } from "@/components/layout/PageHeader";
```

- [ ] **Step 2: Replace the header block**

Replace:
```tsx
      <div className="space-y-1">
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="text-sm text-muted-foreground">Browse the registry by asset type.</p>
      </div>
```
with:
```tsx
      <PageHeader
        eyebrow="BROWSE BY TYPE"
        title="Categories"
        subtitle="Browse the registry by asset type."
      />
```

- [ ] **Step 3: Refine the tile styling**

Replace the `<Link ...>` block inside the categories map with:
```tsx
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
```

- [ ] **Step 4: Verify build + tests**

Run: `pnpm build` → succeeds.
Run: `pnpm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Categories.tsx
git commit -m "feat: editorial Categories header and tiles"
```

---

## Task 3: Full verification

- [ ] **Step 1: Test suite** — Run: `pnpm test` → all pass (incl. new Landing test).
- [ ] **Step 2: Lint** — Run: `pnpm lint` → no new errors in `Landing.tsx` / `Categories.tsx`.
- [ ] **Step 3: Build** — Run: `pnpm build` → succeeds.
- [ ] **Step 4: Boot smoke** — `pnpm dev`, confirm `http://localhost:8080/` and `http://localhost:8080/categories` serve 200.
- [ ] **Step 5: Final commit if needed** — `git add -A && git commit -m "chore: plan 3 verification fixes" || echo "nothing to commit"`

---

## Done criteria

- Landing leads with a Spectral hero, gold eyebrow, primary CTA, a tasteful reveal (reduced-motion-safe), refined feature cards and install block.
- Categories uses PageHeader and editorial tiles with tabular counts.
- All tests pass; build clean.
