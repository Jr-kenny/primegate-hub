# Visual Polish — Plan 5: Publish → Workspace IA Move

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Move publishing into the authed Workspace: add a `/workspace/publish` route (connect-gated by WorkspaceLayout), add a "Publish" entry to the workspace sidebar, and redirect the old public `/publish` there so existing links don't break.

**Architecture:** Reuse the existing `Publish` page component, just mounted under `/workspace`. The public `/publish` route becomes a `<Navigate>` redirect. No changes to the publish flow itself.

**Builds on:** Plans 1–4.

---

## Task 1: Re-route Publish into the Workspace

**Files:** Modify `src/App.tsx`

- [ ] **Step 1: Redirect the public route**

Replace `<Route path="/publish" element={<Publish />} />` (line ~74) with:
```tsx
              <Route path="/publish" element={<Navigate to="/workspace/publish" replace />} />
```

- [ ] **Step 2: Mount Publish under the workspace**

Inside the `/workspace` route group, add (after the `index` route):
```tsx
              <Route path="publish" element={<Publish />} />
```

- [ ] **Step 3: Verify build** — `pnpm build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add src/App.tsx
git commit -m "feat: move publish into workspace, redirect /publish"
```

---

## Task 2: Add Publish to the workspace sidebar

**Files:** Modify `src/components/WorkspaceSidebar.tsx`

- [ ] **Step 1: Import a Publish icon**

Add `Rocket` to the existing `lucide-react` import.

- [ ] **Step 2: Add the nav item**

In `mainItems`, add a Publish entry between Purchases and Publishing:
```tsx
  { label: "Purchases", path: "/workspace/purchases", icon: ShoppingBag },
  { label: "Publish", path: "/workspace/publish", icon: Rocket },
  { label: "Publishing", path: "/workspace/publishing", icon: Upload },
```

- [ ] **Step 3: Verify build** — `pnpm build` → succeeds.

- [ ] **Step 4: Commit**
```bash
git add src/components/WorkspaceSidebar.tsx
git commit -m "feat: add Publish entry to workspace sidebar"
```

---

## Task 3: Verify

- [ ] `pnpm test` → all pass.
- [ ] `pnpm lint` → no new errors.
- [ ] `pnpm build` → succeeds.
- [ ] `pnpm dev`; confirm `/publish` redirects (serves 200 at the workspace) and `/workspace/publish` exists.

---

## Done criteria
- `/publish` redirects to `/workspace/publish` (connect-gated); Publish reachable from the workspace sidebar; no public nav entry (removed in Plan 2).
