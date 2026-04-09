# PrimeGate Registry Hub

## Package Manager

Use `pnpm` for dependency and script commands in this repository.

## Architecture

PrimeGate is split across three layers:

- `Vercel Functions`: API routes under `api/` for registry reads and backend metadata writes
- `Neon Postgres`: package catalog, publisher records, package versions, reviews, and published asset metadata
- `Shelby`: artifact blob storage and publish transport

Current trust model:

- Wallet-scoped records are stored server-side in Neon.
- Wallet-scoped API routes require a signed Aptos wallet session issued through nonce verification.
- Session tokens are stateless HMAC-signed payloads backed by `PRIMEGATE_SESSION_SECRET`.
- Shared wallet-scoped product data does not persist in browser local storage; only the session credential is stored client-side.

Current backend routes:

- `GET /api/health`
- `GET /api/search?q=...`
- `GET /api/packages`
- `GET /api/packages/:id`
- `GET /api/packages/:id/resolve`
- `GET /api/packages/:id/manifest`
- `GET /api/packages/:id/download`
- `GET /api/publishers/:id`
- `POST /api/publish-intent`
- `POST /api/auth/nonce`
- `POST /api/auth/verify`
- `POST /api/auth/message/nonce`
- `POST /api/auth/message/verify`
- `GET /api/published-assets?ownerAddress=...`
- `POST /api/published-assets`
- `GET /api/purchases?walletAddress=...`
- `POST /api/purchases`
- `GET /api/installs?walletAddress=...`
- `POST /api/installs`
- `GET /api/entitlements?walletAddress=...`

Current database files:

- Schema: `db/schema.sql`
- Seed data: `db/seed.sql`

## Environment

Copy `.env.example` to `.env` and provide:

- `DATABASE_URL` for Neon
- `PRIMEGATE_SESSION_SECRET` for signing PrimeGate wallet sessions
- `VITE_API_BASE_URL` only if the frontend should call an API origin other than the current host
- `LOCAL_API_PROXY_TARGET` for local Vite-to-Vercel API proxying, defaults to `http://127.0.0.1:3000`
- `VITE_SHELBY_API_KEY`
- `VITE_SHELBY_RPC_BASE_URL`
- `VITE_APTOS_WALLET_NAME`

## Setup

1. Install dependencies with `pnpm install`.
2. Create a Neon database and run `db/schema.sql`.
3. Seed the initial catalog with `db/seed.sql`.
4. Configure the environment variables from `.env.example`.
5. Run the full local stack with `pnpm dev:local`.
6. If you need them separately, run the local API with `pnpm dev:api` and the frontend with `pnpm dev`.
7. In local development, Vite proxies `/api` to `LOCAL_API_PROXY_TARGET`, which defaults to `http://127.0.0.1:3000`.
8. The local CLI uses the same API contract and defaults to `http://127.0.0.1:3000`:
   - `pnpm primegate search <query>`
   - `pnpm primegate resolve <package-id>`
   - `pnpm primegate install <package-id>`

## Shelby Source Of Truth

This repository uses the Shelby docs MCP as the authoritative reference for Shelby-related implementation details.

When working on Shelby integration, treat these docs as the source of truth:

- React SDK: `https://docs.shelby.xyz/sdks/react`
- `useUploadBlobs`: `https://docs.shelby.xyz/sdks/react/mutations/use-upload-blobs`
- Browser upload guide: `https://docs.shelby.xyz/sdks/typescript/browser/guides/upload`

That applies to:

- `@shelby-protocol/sdk` and `@shelby-protocol/sdk/browser`
- `@shelby-protocol/react`
- wallet adapter usage for Shelby uploads
- blob registration, upload, expiration, and RPC behavior

If the repo code and Shelby docs diverge, update the repo to match the Shelby docs MCP.

## Canonical Package Resolution

PrimeGate is the canonical registry layer across web, CLI, SDK, and MCP.

The intended client flow is:

1. Search PrimeGate with `GET /api/search?q=...`
2. Resolve a package by id with `GET /api/packages/:id/resolve`
3. Follow the returned PrimeGate manifest and download URLs instead of querying Shelby directly

The repo also includes a thin client helper in `src/lib/primegate-client.ts` and a local CLI entrypoint in `src/cli/primegate.ts` built on the same contract.

For PrimeGate-published Shelby assets, the resolution payload now carries:

- the canonical PrimeGate resolve URL
- the PrimeGate manifest URL
- the PrimeGate download URL
- the underlying Shelby blob metadata and owner address

Only artifacts finalized through PrimeGate should appear in PrimeGate search results and package resolution.
