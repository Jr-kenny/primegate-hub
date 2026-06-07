# Visual Polish — Plan 1: Foundations + Core Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the "warm editorial" design foundation (fonts, refined sand/gold tokens for light + dark, theme toggle, motion config) and the two most-reused composed components (`PackageCard`, `PageHeader`), so later plans can reskin every surface by composition.

**Architecture:** Keep the existing token-driven Tailwind/shadcn setup. Refine CSS variables in `src/index.css` (light `:root` + `.dark`), register Spectral (serif) + Inter (sans) via self-hosted `@fontsource`, wire `next-themes` `ThemeProvider` + a `ThemeToggle`, wrap the app in framer-motion's `MotionConfig reducedMotion="user"`, then extract a reusable `PackageCard` and `PageHeader`.

**Tech Stack:** React 18, Vite 5, Tailwind 3 (class dark mode), shadcn/Radix, next-themes (installed), framer-motion (new), @fontsource/spectral + @fontsource/inter (new). Tests: vitest + jsdom + @testing-library/react.

**Reference spec:** `docs/superpowers/specs/2026-06-07-visual-ux-polish-design.md`

---

## File Structure

- Modify: `package.json` — add `framer-motion`, `@fontsource/inter`, `@fontsource/spectral`
- Modify: `src/main.tsx` — import font CSS
- Modify: `tailwind.config.ts` — add `fontFamily` (serif/sans), keep everything else
- Modify: `src/index.css` — refine light + dark token values; set base serif/sans usage
- Create: `src/components/theme/ThemeProvider.tsx` — next-themes wrapper
- Create: `src/components/theme/ThemeToggle.tsx` — light/dark toggle button
- Create: `src/components/theme/ThemeToggle.test.tsx`
- Modify: `src/PrimeGateRuntime.tsx` — wrap tree in `ThemeProvider` + `MotionConfig`
- Create: `src/components/package/PackageCard.tsx` — reusable package card
- Create: `src/components/package/PackageCard.test.tsx`
- Create: `src/components/layout/PageHeader.tsx` — eyebrow + serif title + subtitle/actions
- Create: `src/components/layout/PageHeader.test.tsx`

> Note: this plan does NOT yet swap the inline cards in `Discover.tsx` etc. — that happens in Plan 2 when we reskin public surfaces. Plan 1 only creates the building blocks and proves they render.

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime + font packages**

Run:
```bash
cd /Users/user/Documents/primegate-hub
pnpm add framer-motion @fontsource/inter @fontsource/spectral
```
Expected: packages added to `dependencies`, lockfile updated, no peer-dep errors.

- [ ] **Step 2: Verify install**

Run: `pnpm ls framer-motion @fontsource/inter @fontsource/spectral`
Expected: all three resolve with versions.

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: add framer-motion and Spectral/Inter font packages"
```

---

## Task 2: Load fonts

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Import font weights at the top of `src/main.tsx`**

Add these imports directly under the existing `import "./polyfills";` line:
```ts
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/spectral/400.css";
import "@fontsource/spectral/600.css";
import "@fontsource/spectral/700.css";
```

- [ ] **Step 2: Verify the app still builds**

Run: `pnpm build`
Expected: build succeeds, fonts bundled (no "module not found").

- [ ] **Step 3: Commit**

```bash
git add src/main.tsx
git commit -m "feat: self-host Inter and Spectral fonts"
```

---

## Task 3: Register font families in Tailwind

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Add a `fontFamily` block inside `theme.extend`**

In `tailwind.config.ts`, inside `theme.extend` (e.g. right after the `colors: { ... }` block), add:
```ts
fontFamily: {
  sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
  serif: ['"Spectral"', "Georgia", "Cambria", "serif"],
},
```

- [ ] **Step 2: Verify typecheck/build**

Run: `pnpm build`
Expected: build succeeds. (`font-serif` / `font-sans` utilities now resolve to Spectral / Inter.)

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: map font-sans/font-serif to Inter/Spectral"
```

---

## Task 4: Refine color tokens (light + dark) and base typography

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Replace the `:root` light token values**

In `src/index.css`, replace the existing `:root` block values with these warm-editorial light values (keep the variable NAMES identical so all components keep working):
```css
:root {
  --background: 41 39% 94%;        /* #f7f3ea sand */
  --foreground: 36 17% 15%;        /* #2b2620 */

  --card: 0 0% 100%;               /* #ffffff */
  --card-foreground: 36 17% 15%;

  --popover: 44 40% 97%;           /* #fbf8f1 raised */
  --popover-foreground: 36 17% 15%;

  --primary: 38 42% 42%;           /* #9a7b3f gold */
  --primary-foreground: 44 60% 98%;

  --secondary: 42 33% 90%;         /* #efe7d6 */
  --secondary-foreground: 36 17% 25%;

  --muted: 42 25% 88%;
  --muted-foreground: 40 11% 47%;  /* #8a7e68 */

  --accent: 38 42% 42%;
  --accent-foreground: 44 60% 98%;

  --destructive: 0 60% 50%;
  --destructive-foreground: 0 0% 100%;

  --border: 41 33% 84%;            /* #e6dcc6 */
  --input: 41 33% 84%;
  --ring: 38 42% 42%;

  --radius: 0.75rem;

  --sidebar-background: 36 22% 14%;
  --sidebar-foreground: 42 30% 88%;
  --sidebar-primary: 38 55% 66%;   /* #d8b878 */
  --sidebar-primary-foreground: 36 22% 12%;
  --sidebar-accent: 36 18% 20%;
  --sidebar-accent-foreground: 42 30% 88%;
  --sidebar-border: 36 16% 22%;
  --sidebar-ring: 38 55% 66%;
  --sidebar-muted: 40 14% 55%;

  --nav-highlight: 38 50% 50%;
}
```

- [ ] **Step 2: Replace the `.dark` token values**

Replace the existing `.dark` block values with these warm-dark values (not a cold invert):
```css
.dark {
  --background: 38 20% 7%;         /* #17140f */
  --foreground: 41 36% 87%;        /* #ece3d2 */

  --card: 36 24% 10%;              /* #201b13 */
  --card-foreground: 41 36% 87%;

  --popover: 36 24% 10%;
  --popover-foreground: 41 36% 87%;

  --primary: 38 55% 66%;           /* #d8b878 */
  --primary-foreground: 38 20% 9%;

  --secondary: 36 22% 16%;         /* #3a3020 */
  --secondary-foreground: 41 30% 84%;

  --muted: 36 18% 16%;
  --muted-foreground: 40 12% 55%;  /* #9c917b */

  --accent: 40 45% 58%;            /* #caa765 */
  --accent-foreground: 38 20% 9%;

  --destructive: 0 60% 42%;
  --destructive-foreground: 0 0% 100%;

  --border: 36 22% 16%;            /* #322a1d */
  --input: 36 22% 16%;
  --ring: 38 55% 66%;

  --sidebar-background: 38 24% 6%;
  --sidebar-foreground: 41 30% 85%;
  --sidebar-primary: 38 55% 62%;
  --sidebar-primary-foreground: 38 20% 8%;
  --sidebar-accent: 36 20% 12%;
  --sidebar-accent-foreground: 41 30% 85%;
  --sidebar-border: 36 18% 14%;
  --sidebar-ring: 38 55% 62%;
  --sidebar-muted: 40 16% 45%;

  --nav-highlight: 38 50% 55%;
}
```

- [ ] **Step 3: Set base font + tabular numerals**

In `src/index.css`, find the `@layer base` section that targets `body` (or add one if absent) and ensure body uses the sans font, and add a numeric utility. Add at the end of the `@layer base` block:
```css
@layer base {
  body {
    @apply bg-background text-foreground font-sans;
    font-feature-settings: "cv11", "ss01";
    -webkit-font-smoothing: antialiased;
  }
  .tabular-nums {
    font-variant-numeric: tabular-nums;
  }
}
```
(If a `body { @apply ... }` rule already exists, edit it to include `font-sans` rather than duplicating.)

- [ ] **Step 4: Verify build and eyeball both themes**

Run: `pnpm build`
Expected: build succeeds.
Then run `pnpm dev:local`, open the app, and confirm the sand background + gold accents render. (Dark mode toggle comes in Task 6 — for now temporarily add `class="dark"` to `<html>` in `index.html` to spot-check dark, then remove it.)

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "feat: refine sand/gold tokens for light and warm dark themes"
```

---

## Task 5: Create the ThemeProvider

**Files:**
- Create: `src/components/theme/ThemeProvider.tsx`

- [ ] **Step 1: Write the provider**

Create `src/components/theme/ThemeProvider.tsx`:
```tsx
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({ children, ...props }: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/theme/ThemeProvider.tsx
git commit -m "feat: add next-themes ThemeProvider (class strategy)"
```

---

## Task 6: Create the ThemeToggle (TDD)

**Files:**
- Create: `src/components/theme/ThemeToggle.test.tsx`
- Create: `src/components/theme/ThemeToggle.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/theme/ThemeToggle.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const setTheme = vi.fn();
vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme }),
}));

import { ThemeToggle } from "./ThemeToggle";

describe("ThemeToggle", () => {
  it("renders an accessible toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: /toggle theme/i })).toBeInTheDocument();
  });

  it("switches to dark when clicked from light", () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/theme/ThemeToggle.test.tsx`
Expected: FAIL — cannot find module `./ThemeToggle`.

- [ ] **Step 3: Write the component**

Create `src/components/theme/ThemeToggle.tsx`:
```tsx
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/theme/ThemeToggle.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/theme/ThemeToggle.tsx src/components/theme/ThemeToggle.test.tsx
git commit -m "feat: add ThemeToggle with light/dark switch"
```

---

## Task 7: Wire ThemeProvider + MotionConfig into the app

**Files:**
- Modify: `src/PrimeGateRuntime.tsx`

- [ ] **Step 1: Wrap the provider tree**

Replace the contents of `src/PrimeGateRuntime.tsx` with:
```tsx
import { MotionConfig } from "framer-motion";

import App from "./App";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { Web3Providers } from "./components/Web3Providers";
import { PrimeGateWalletProvider } from "./hooks/usePrimeGateWallet";

export default function PrimeGateRuntime() {
  return (
    <ThemeProvider>
      <MotionConfig reducedMotion="user">
        <Web3Providers>
          <PrimeGateWalletProvider>
            <App />
          </PrimeGateWalletProvider>
        </Web3Providers>
      </MotionConfig>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Verify build + run**

Run: `pnpm build`
Expected: build succeeds.
Then `pnpm dev:local` and confirm the app still loads (no provider crash). The `MotionConfig reducedMotion="user"` makes all framer-motion animations respect the OS reduced-motion setting globally.

- [ ] **Step 3: Commit**

```bash
git add src/PrimeGateRuntime.tsx
git commit -m "feat: wire ThemeProvider and reduced-motion-aware MotionConfig"
```

---

## Task 8: Create PageHeader (TDD)

**Files:**
- Create: `src/components/layout/PageHeader.test.tsx`
- Create: `src/components/layout/PageHeader.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/layout/PageHeader.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders eyebrow, title and subtitle", () => {
    render(
      <PageHeader eyebrow="THE REGISTRY" title="Discover" subtitle="Browse packages" />,
    );
    expect(screen.getByText("THE REGISTRY")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Discover" })).toBeInTheDocument();
    expect(screen.getByText("Browse packages")).toBeInTheDocument();
  });

  it("renders action slot content", () => {
    render(<PageHeader title="Discover" actions={<button>Publish</button>} />);
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/layout/PageHeader.test.tsx`
Expected: FAIL — cannot find module `./PageHeader`.

- [ ] **Step 3: Write the component**

Create `src/components/layout/PageHeader.tsx`:
```tsx
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, eyebrow, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary">{eyebrow}</p>
        ) : null}
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/layout/PageHeader.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/PageHeader.tsx src/components/layout/PageHeader.test.tsx
git commit -m "feat: add PageHeader (editorial eyebrow + serif title)"
```

---

## Task 9: Create PackageCard (TDD)

**Files:**
- Create: `src/components/package/PackageCard.test.tsx`
- Create: `src/components/package/PackageCard.tsx`

This extracts the canonical card unit. It takes a `RegistryPackage` (from `src/lib/registry-data.ts`) and links to `/package/:id`. Free vs paid is derived from `price`.

- [ ] **Step 1: Write the failing test**

Create `src/components/package/PackageCard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect } from "vitest";

import type { RegistryPackage } from "@/lib/registry-data";
import { PackageCard } from "./PackageCard";

const basePackage: RegistryPackage = {
  id: "pkg_1",
  name: "Vision Embeddings",
  description: "Multimodal CLIP embeddings with agent-ready manifest.",
  publisher: "@labs/perception",
  type: "dataset",
  installs: 12400,
  price: "Free",
  verified: true,
  agentReady: true,
  version: "2.4.0",
  license: "MIT",
  runtime: "python",
  chain: "aptos",
  publisherSummary: "",
  publisherPackageCount: 3,
  publisherMemberSince: "2025",
  usageSnippet: "",
  reviews: [],
  versions: [],
};

function renderCard(pkg: RegistryPackage) {
  return render(
    <MemoryRouter>
      <PackageCard package={pkg} />
    </MemoryRouter>,
  );
}

describe("PackageCard", () => {
  it("shows name, publisher, version and license", () => {
    renderCard(basePackage);
    expect(screen.getByText("Vision Embeddings")).toBeInTheDocument();
    expect(screen.getByText(/@labs\/perception/)).toBeInTheDocument();
    expect(screen.getByText("v2.4.0")).toBeInTheDocument();
    expect(screen.getByText(/MIT/)).toBeInTheDocument();
  });

  it("links to the package detail route", () => {
    renderCard(basePackage);
    expect(screen.getByRole("link", { name: /Vision Embeddings/ })).toHaveAttribute(
      "href",
      "/package/pkg_1",
    );
  });

  it("renders an Install action for free packages", () => {
    renderCard(basePackage);
    expect(screen.getByText(/Install/)).toBeInTheDocument();
  });

  it("renders the price as a buy action for paid packages", () => {
    renderCard({ ...basePackage, price: "$12" });
    expect(screen.getByText(/\$12/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/components/package/PackageCard.test.tsx`
Expected: FAIL — cannot find module `./PackageCard`.

- [ ] **Step 3: Write the component**

Create `src/components/package/PackageCard.tsx`:
```tsx
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import type { RegistryPackage } from "@/lib/registry-data";
import { cn } from "@/lib/utils";

type PackageCardProps = {
  package: RegistryPackage;
  className?: string;
};

function formatInstalls(installs: number): string {
  if (installs >= 1000) {
    return `${(installs / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(installs);
}

export function PackageCard({ package: pkg, className }: PackageCardProps) {
  const isFree = pkg.price.trim().toLowerCase() === "free";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className={cn(
        "group rounded-xl border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          to={`/package/${pkg.id}`}
          className="font-serif text-lg font-semibold leading-tight text-card-foreground hover:underline"
        >
          {pkg.name}
        </Link>
        <span className="shrink-0 rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground tabular-nums">
          v{pkg.version}
        </span>
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {pkg.publisher} · {pkg.license}
      </p>

      <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{pkg.description}</p>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
        <span className="text-xs text-muted-foreground tabular-nums">
          {formatInstalls(pkg.installs)} installs
        </span>
        <span className="text-xs font-semibold text-primary">
          {isFree ? "Install →" : `${pkg.price} · Buy`}
        </span>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test src/components/package/PackageCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/package/PackageCard.tsx src/components/package/PackageCard.test.tsx
git commit -m "feat: add reusable editorial PackageCard"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run the whole test suite**

Run: `pnpm test`
Expected: all tests pass (existing + the 3 new test files).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors in created/modified files. Fix any that appear.

- [ ] **Step 3: Production build**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Manual smoke test (both themes)**

Run: `pnpm dev:local`. In the app:
- Confirm sand background + gold accents (light).
- Temporarily drop a `<ThemeToggle />` into any visible spot (or use the one wired in Plan 2) to flip to dark and confirm the warm dark theme renders with gold accents (not a grey invert). Revert any temporary placement.

- [ ] **Step 5: Final commit if anything changed during verification**

```bash
git add -A
git commit -m "chore: plan 1 verification fixes" || echo "nothing to commit"
```

---

## Done criteria

- `font-serif` → Spectral, `font-sans` → Inter, both self-hosted.
- Light + warm-dark token sets in place; theme toggleable via `ThemeToggle` / `next-themes`.
- App wrapped in `MotionConfig reducedMotion="user"` (global reduced-motion respect).
- `PackageCard` and `PageHeader` exist, tested, and ready for Plan 2 to consume across surfaces.
