# Affest Phase 1–3 Execution Plan

Status: local Phases 1–3 complete; live proof gate pending
Started: 2026-09-08

Implementation proceeded continuously through every checkpoint that can be
completed locally. Real testnet deployment remains an explicit external gate:
no private key, funded account, or transaction has been invented.

## Phase 1 — proof vertical slice

- [x] Strict proof payload boundary matching `@gluwa/usc-sdk@0.18.0`.
- [x] Sepolia `PortfolioSignalEmitter` with duplicate signal protection.
- [x] Creditcoin verifier using official ASC interfaces and BlockProver address.
- [x] Receipt success, emitter, event signature, log, user, asset, amount, and
  signal-type validation.
- [x] Replay rejection keyed by query ID and receipt log index.
- [x] Read-only `proof:inspect` command and live-testnet runbook.
- [x] Official-shaped proof fixture and adversarial verifier tests.

Local exit gate: passed. Testnet exit gate: pending funded accounts, deployed
addresses, and RPC access.

## Phase 2 — strategy contracts

- [x] `AffestVaultFactory`, `AffestVault`, `AffestStrategyManager`,
  `AffestAttestationVerifier`, and `AffestExecutor`.
- [x] Approval, automatic, and hybrid policy enforcement.
- [x] Per-action/weekly limits, expiry, cooldown, slippage, allocation, role,
  allowlist, pause, and replay enforcement.
- [x] `ISwapAdapter`, two labelled demo assets, and fixed-pair
  `DemoSwapAdapter` (not a production DEX).
- [x] Audit events and reentrancy protection.

Exit gate: 35 Foundry tests pass.

## Phase 3 — domain, database, and worker

- [x] Strict integer-unit strategy schema and user-approval application service.
- [x] Drizzle schema/migration for users, portfolios, strategies, credentials,
  triggers, actions, executions, and worker cursors.
- [x] Memory and Postgres coordination stores with lifecycle validation,
  unique source-event idempotency, proof persistence, and durable cursors.
- [x] Injectable Sepolia monitoring, attestation readiness/proof orchestration,
  simulation/submission ports, bounded processing, and restart-safe cursoring.
- [ ] Full repository integration tests for every CRUD entity.
- [x] Structured redacted logs and worker health snapshot.

## Verification

- [x] `pnpm test` — all TypeScript suites and 35 Foundry tests.
- [x] `pnpm typecheck` — strict TypeScript and Forge build.
- [x] `pnpm build` — all Phase 1–3 packages and worker.
- [x] Secret-pattern and committed-artifact audit (no key material found).

The remaining unchecked items are intentionally deferred follow-ups, not
claims of a completed live deployment or production service surface.

## Phase 4–5 continuation

- [x] MCP server package with Streamable HTTP transport, strict tool schemas,
  HMAC-hashed revocable credentials, audit records, and idempotent action
  previews.
- [x] Read, planning, proof, and action tool surface registered against the
  same policy language used by the application package.
- [x] Responsive Affest dashboard preview with wallet/network states,
  allocation, strategy controls, proof lifecycle, activity, and agent access.
- [x] MCP health/credential smoke test and full workspace build/test pass.
- [ ] Connect MCP tools and dashboard queries to Postgres-backed production
  repositories and live deployed contract addresses.
- [ ] Replace static dashboard preview with the installed Next runtime when the
  host can install its platform SWC dependency.
