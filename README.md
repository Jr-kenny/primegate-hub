# PrimeGate Registry Hub

PrimeGate is a registry and access layer for agent-ready packages. It turns Shelby-backed files into searchable, versioned, installable releases with one canonical contract across web, CLI, SDK, and agent workflows.

## What PrimeGate Does

- Gives every package a stable publisher-scoped identity, immutable SemVer releases, a rich manifest, and a download path.
- Lets publishers upload once and manage releases from a single registry surface.
- Stores the release README, license, keywords, release notes, and channel alongside the artifact hash.
- Represents the commercial layer as an offer attached to a release, then records the buyer's entitlement to that offer.
- Lets users discover packages on the web and install them through PrimeGate instead of talking to storage directly.
- Encrypts new release bytes before they leave the publisher's browser, so Shelby stores ciphertext and PrimeGate controls decryption.
- Supports free and paid releases, with Aptos-based wallet auth and listing flow.

## How It Works

1. A publisher connects a wallet and creates a publish intent.
2. PrimeGate prepares the release metadata and default offer, encrypts the artifact and manifest in chunks, then uploads ciphertext to Shelby.
3. PrimeGate verifies the encrypted blobs, wraps the release key with the API key-encryption secret, and stores the catalog record in the registry.
4. Clients search, resolve the release and offer, then receive decrypted bytes only through an authorized PrimeGate URL.

## Why It Matters

- Shelby handles ciphertext storage.
- PrimeGate handles package identity, discovery, resolution, installs, and access.
- PrimeGate keeps the release key behind the API boundary and streams decrypted ranges only after access checks.
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
- `PRIMEGATE_PUBLISH_SECRET`
- `PRIMEGATE_CONTENT_KEY_SECRET`
- `VITE_SHELBY_API_KEY`
- `VITE_SHELBY_RPC_BASE_URL`
- `VITE_APTOS_WALLET_NAME`
- `VITE_PRIMEGATE_REGISTRY_ADDRESS`

The current published release model is one canonical artifact, usually a ZIP for a multi-file package, plus one encrypted manifest and one default offer. Run the updated `db/schema.sql` before publishing new releases against an existing database. Releases created before the encrypted format are legacy plaintext Shelby objects and must be republished or migrated before a mainnet launch submission can claim complete PrimeGate-only content access.

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
pnpm primegate verify <package-id>
pnpm primegate publish --manifest <path>
```
