# PrimeGate Registry Hub

PrimeGate is a registry and access layer for agent-ready packages. It turns Shelby-backed files into searchable, versioned, installable releases with one canonical contract across web, CLI, SDK, and agent workflows.

## What PrimeGate Does

- Gives every package a stable identity, release version, manifest, and download path.
- Lets publishers upload once and manage releases from a single registry surface.
- Lets users discover packages on the web and install them through PrimeGate instead of talking to storage directly.
- Supports free and paid releases, with Aptos-based wallet auth and listing flow.

## How It Works

1. A publisher connects a wallet and creates a publish intent.
2. PrimeGate prepares the release metadata and uploads the artifact plus manifest to Shelby.
3. PrimeGate finalizes the release and stores the catalog record in the registry.
4. Clients search, resolve, and install through PrimeGate-owned URLs.

## Why It Matters

- Shelby handles storage.
- PrimeGate handles package identity, discovery, resolution, installs, and access.
- The same package can be consumed by humans, CLIs, and agents without each client inventing its own flow.

## Product Surfaces

- Web app for discovery, publisher identity, release browsing, and browser publishing.
- API for search, resolve, manifest, download, and publish flows.
- CLI for search, resolve, install, and publish automation.

## Core Stack

- `Vercel`: frontend and API hosting
- `Neon Postgres`: package, publisher, and release metadata
- `Shelby`: artifact storage
- `Aptos`: wallet auth and paid listing flow

## Local Setup

1. Install dependencies with `pnpm install`.
2. Copy `.env.example` to `.env`.
3. Run `db/schema.sql` and `db/seed.sql` against your Neon database.
4. Start the app with `pnpm dev:local`.

Required env values:

- `DATABASE_URL`
- `PRIMEGATE_SESSION_SECRET`
- `VITE_SHELBY_API_KEY`
- `VITE_SHELBY_RPC_BASE_URL`
- `VITE_APTOS_WALLET_NAME`
- `VITE_PRIMEGATE_REGISTRY_ADDRESS`

Optional:

- `VITE_API_BASE_URL`
- `LOCAL_API_PROXY_TARGET`

## Useful Commands

```bash
pnpm dev:local
pnpm test
pnpm lint
pnpm primegate search "dataset"
pnpm primegate resolve <package-id>
pnpm primegate install <package-id>
pnpm primegate publish --manifest <path>
```
