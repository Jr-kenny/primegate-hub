# Shelby Review

This note covers PrimeGate's Shelby integration and its production boundary.

## Implemented

- Browser publishing uses Shelby's lower-level streaming path. PrimeGate generates commitments from `File.stream()`, registers the asset and manifest in one Aptos transaction, then sends both blobs to Shelby RPC without buffering the asset in one browser array.
- New browser and CLI releases use a versioned AES-256-GCM chunk format with a 64-byte header and 1 MiB chunks. The browser encrypts the artifact and manifest before the Shelby upload, while the API verifies the decrypted hash incrementally.
- The publish intent accepts an optional client hash. The API re-reads the encrypted asset from Shelby, decrypts one chunk at a time, and computes its SHA-256 incrementally before saving the release record.
- Each release gets a random content key. PrimeGate stores only an AES-GCM key envelope in Neon, protected by `PRIMEGATE_CONTENT_KEY_SECRET`. The raw content key is never stored in the catalog.
- Direct Shelby reads can expose ciphertext metadata and bytes, but they do not expose usable release plaintext. PrimeGate decrypts full downloads and byte ranges only after the normal access check.
- There is no default PrimeGate product upload ceiling. Deployments can set `PRIMEGATE_MAX_UPLOAD_BYTES` when they need an explicit operational guard.
- Published artifact downloads pass through the PrimeGate authorization endpoint. Paid downloads require the on-chain purchase entitlement before the Shelby stream is opened.
- Artifact downloads support single byte ranges and return `206`, `Content-Range`, `Content-Length`, and `Accept-Ranges`. Invalid ranges return `416`.
- Paid resolve, manifest, and artifact responses are private and non-cacheable. Free responses can use short public cache windows.
- Finalization treats the package slug and SemVer release as immutable. A repeated finalize is idempotent, while a different blob cannot reuse an existing release ID.
- The manifest carries package metadata, release channel, and the default commercial offer. The registry returns that offer with the resolution and stores it with purchase records.
- Publisher publish bytes are reserved before Shelby registration and committed after finalization. The usage ledger uses stable keys for retries, and protected downloads record publisher egress by release and delivered byte range.
- The application provides the shared query and Shelby client providers required by the browser SDK.
- New Shelby blob names are opaque `primegate/content/<release-id>/...` paths without the original extension or package slug.

## External requirements

Publishing still depends on the Shelby and Aptos environment being funded and configured:

- Aptos Testnet gas for the registration transaction
- ShelbyUSD or the configured Shelby storage billing path
- a frontend-safe `VITE_SHELBY_API_KEY` for browser RPC requests
- `PRIMEGATE_PUBLISH_SECRET` and `PRIMEGATE_SESSION_SECRET` on the API
- `PRIMEGATE_CONTENT_KEY_SECRET` on the API, with at least 32 random characters
- `DATABASE_URL` for publish intents, verification, sessions, and the registry

The server-side Shelby client uses `SHELBY_API_KEY` and `SHELBY_RPC_BASE_URL` when those variables are configured. The browser key remains separate.

## Remaining production work

The browser flow still needs a durable resume action for a failure after on-chain blob registration but before PrimeGate finalization. The current release status and listing retry path cover failed paid listings after finalization. They do not yet recover every interrupted upload attempt automatically.

Publisher billing now has the free allowance, usage, reservation, and credit ledger boundary. It still needs a real checkout rail and the sponsored Shelby registration path before PrimeGate can remove Aptos gas and ShelbyUSD funding from the publisher onboarding flow.

Existing testnet releases created before the encrypted format remain legacy plaintext objects in Shelby. They need a republish or migration pass before production submission if the submission claims that every release is PrimeGate-only.
