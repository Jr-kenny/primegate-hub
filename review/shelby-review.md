# Shelby Review

This note is only about the Shelby integration in PrimeGate.

## What Is Already Correct

- The browser publish flow follows Shelby's required order: encode, register on-chain, then upload to the RPC.
- The app waits for the registration transaction to settle before calling `putBlob`, which matches Shelby's browser upload guide.
- The repo is already using Shelby's browser SDK and React hooks instead of hand-rolling raw RPC requests.

## Current Limitations

### 1. Browser publish is using the low-level path instead of the full upload mutation

Shelby's React docs describe `useUploadBlobs` as the mutation that handles the full upload flow, including encoding, on-chain registration, RPC upload, and skipping registration when a blob already exists.

PrimeGate browser publish currently stitches this together manually with:

- `useEncodeBlobs`
- `useRegisterCommitments`
- direct `shelbyClient.rpc.putBlob(...)`

That works, but it means:

- more moving parts in the browser publish path
- more surface for partial failure
- no built-in "already registered" shortcut from the higher-level Shelby flow

Current file:

- [useShelbyPublish.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/hooks/useShelbyPublish.ts)

### 2. Browser uploads depend on a frontend Shelby API key

The Shelby API key guide says frontend usage should use a client key, not a private server key.

PrimeGate reads Shelby from:

- `VITE_SHELBY_API_KEY`

That means the integration is only safe if the configured key is a frontend-safe client key. If the wrong key type is used, browser uploads can fail or expose the wrong credential shape.

Current files:

- [web3-constants.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/config/web3-constants.ts)
- [web3.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/config/web3.ts)

### 3. Publishing still has hard external prerequisites

Shelby's browser upload guide requires:

- Aptos Testnet
- APT for gas
- ShelbyUSD for storage uploads

PrimeGate currently reflects those requirements in the UI, but it does not abstract them away. First-time publishers can still get blocked before upload starts.

Current file:

- [Publish.tsx](C:/Users/LDC/Documents/primegate-registry-hub/src/pages/Publish.tsx)

### 4. The browser path has no resume or recovery around partial Shelby success

PrimeGate creates a publish intent before the Shelby steps run. If one Shelby step succeeds and a later step fails, the user is left retrying manually.

This matters most in the window between:

- successful on-chain registration
- successful RPC upload
- successful PrimeGate finalize

The repo does not currently expose a browser-side resume flow for that state.

Current files:

- [useShelbyPublish.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/hooks/useShelbyPublish.ts)
- [registry-api.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/lib/registry-api.ts)

### 5. Browser and CLI Shelby paths can drift

The CLI uses `ShelbyNodeClient.upload()`.

The browser publish path does not. It uses the lower-level React hooks and direct RPC upload.

That means the two PrimeGate publishing surfaces are not using the same Shelby abstraction, so future Shelby fixes may land in one path and not the other.

Current file:

- [primegate.ts](C:/Users/LDC/Documents/primegate-registry-hub/src/cli/primegate.ts)

## Errors And Blockers We Hit Around Shelby

### Missing Shelby API key

Publishing fails immediately if `VITE_SHELBY_API_KEY` is missing.

### Wrong wallet network

Publishing is blocked until the wallet is on Aptos Testnet.

### Missing ShelbyUSD or APT

Even with the wallet connected, publishing can still fail if the wallet is not funded for both:

- transaction gas
- Shelby storage upload cost

### Partial publish state

If Shelby registration or RPC upload fails after PrimeGate has already issued a publish intent, the user can end up with a half-finished publish attempt and no built-in recovery path in the browser flow.
