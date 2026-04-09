# PrimeGate Registry Hub Agent Notes

## Package Manager

Use `pnpm` for install, add, remove, and script commands in this repository unless the user explicitly asks for another tool.

## Source Of Truth

Use the Shelby docs MCP as the source of truth for every Shelby-related decision in this repository.

This applies to:

- `@shelby-protocol/sdk` and `@shelby-protocol/sdk/browser`
- `@shelby-protocol/react`
- Shelby upload, blob registration, expiration, and RPC flow behavior
- Aptos wallet integration patterns used for Shelby actions
- Shelby terminology, constraints, and expected payload shapes

If local code, comments, TODOs, or older examples disagree with the Shelby docs MCP, follow the Shelby docs MCP and update the repo to match it.

## Shelby References

Start with these Shelby docs MCP pages when working on the current integration:

- React SDK: `https://docs.shelby.xyz/sdks/react`
- `useUploadBlobs`: `https://docs.shelby.xyz/sdks/react/mutations/use-upload-blobs`
- Browser upload guide: `https://docs.shelby.xyz/sdks/typescript/browser/guides/upload`

## Working Rule

Before making Shelby-related changes, verify the relevant API or workflow against the Shelby docs MCP. Do not rely on memory for Shelby SDK usage in this repo.

Files currently covered by this rule include:

- `src/config/web3.ts`
- `src/hooks/useShelbyPublish.ts`
- any future Shelby wallet, blob, registry sync, or publishing logic
