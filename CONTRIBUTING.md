# Contributing

Contributions are welcome. Short version: ship changes that work, can be reviewed, and respect the boundary PrimeGate provides around package access and storage.

PrimeGate is a working registry, API, and CLI for versioned digital assets. It handles wallet identity, release metadata, access offers, encrypted artifacts, Shelby storage, protected delivery, and publisher usage. Changes here can affect real package publishing, Aptos transactions, stored release state, usage accounting, or access to paid content, so care is part of the implementation.

## The bar

Every pull request gets reviewed before merge. These are the things that get pull requests bounced:

**No AI slop.** Using AI tools to help you code is fine. Pasting whatever a model produced without reading it, understanding it, or testing it is not. If you cannot explain every line of your pull request when asked, it is not ready. Dead code, unnecessary abstractions, invented APIs, comments that narrate obvious code, and error handling that catches everything and does nothing will be rejected.

**It has to actually run.** Before opening a pull request, run the change. Watch it work. Include the exact commands and relevant output in the pull request description. "Tested locally" without detail is not enough.

**Small and focused.** One pull request should do one thing. Split features, refactors, formatting passes, and unrelated cleanup into separate changes. Small diffs are easier to review and safer to deploy.

**Match what is there.** Follow the existing structure, naming, TypeScript patterns, and product language around your change. Do not add a new framework, dependency, or application pattern without opening an issue first.

**Respect the storage boundary.** New browser and CLI uploads must preserve the encrypted upload flow. Do not expose raw Shelby access paths, plaintext objects, content keys, or storage credentials through the public API. Resolve and download behavior belongs behind PrimeGate access checks.

**Keep billing idempotent.** Publisher usage is separate from package purchase settlement. Publish reservations, usage events, credit changes, and delivery metering need stable idempotency keys and must remain safe across retries.

**No secrets, ever.** Database URLs, Aptos wallet material, Shelby API keys, session secrets, publish secrets, and content-key secrets never go into the repository. Use local environment files and keep them out of commits. If a secret is committed even once, treat it as burned and rotate it.

**Handle the sad path.** Wallet rejection, wrong network, failed Shelby upload, pending or reverted Aptos transactions, database failures, invalid ranges, expired access, and incomplete releases all need clear behavior. Fail loudly and preserve enough context to diagnose the problem. Never swallow errors silently.

## Local setup

PrimeGate uses `pnpm`.

```bash
pnpm install
cp .env.example .env.local
pnpm dev:local
```

Apply [`db/schema.sql`](db/schema.sql) to a development Neon database before testing publish flows. Keep live credentials and wallet material in local environment variables only.

## Verification

Run the local gates before pushing:

```bash
pnpm test
pnpm exec tsc --noEmit
pnpm build
pnpm lint
git diff --check
```

Changes that touch publishing, Shelby, Aptos, encryption, access control, or range delivery need focused verification as well. Describe whether the check was unit-level, local integration, testnet, or production. A passing mock or UI label is not proof of a completed upload, transaction, payment, or release.

For live checks, use isolated testnet data and accounts. Do not use production wallet keys or production database credentials in local tests.

## Process

1. For substantial work, open an issue first so the approach can be agreed before implementation. Small fixes can go straight to a pull request.
2. Use a focused branch name such as `web/package-card`, `api/range-download`, or `cli/verify-command`.
3. Keep the pull request focused and explain what changed, why it changed, and what remains outside its scope.
4. Include the exact verification commands and the result for each one.
5. A maintainer reviews and merges the change. Review comments are about the code and the evidence, not about the contributor.

## Where contributions help

Useful contribution areas include:

- package discovery, search, and publisher experiences.
- CLI and SDK compatibility with the shared release contract.
- encrypted upload, resume, streaming, and range verification.
- publisher quotas, usage metering, credits, and subscription integrations.
- Aptos testnet and mainnet operational tooling.
- observability, recovery paths, and test coverage.
- documentation that helps publishers and consumers use real releases.

Before starting a larger change, check the existing issues and release model so the contribution fits the package, access, and storage boundaries already in the system.

## If you are stuck

Say so early in the issue or pull request. A clear note about what works, what fails, and what you tried is useful. Half-working code with an honest blocker is easier to help with than silence.
