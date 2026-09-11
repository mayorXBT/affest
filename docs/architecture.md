# Affest architecture (Phase 1–3)

Affest is split into a read-only cross-chain proof pipeline, policy-enforcing
Creditcoin contracts, and a restart-safe coordination worker. The dashboard and
future MCP server will call the same application/domain boundaries; neither is
trusted to enforce permissions.

```text
Ethereum Sepolia PortfolioSignalEmitter
        │ logs + receipt
        ▼
AttestationWorker ──► Attestcoin proof API / @gluwa/usc-sdk
        │ persisted trigger + proof
        ▼
AffestExecutor ──► AffestAttestationVerifier ──► official BlockProver precompile
        │ verified event key
        ▼
AffestStrategyManager ──► AffestVault ──► ISwapAdapter
```

## Trust boundaries

- Ethereum logs and the worker database are observations, not permissions.
- `AffestAttestationVerifier` is the first component allowed to turn a source
  observation into a verified signal. It checks receipt success, emitter,
  signature, decoded fields, source chain key, and replay state.
- `AffestStrategyManager` enforces allocation and execution policy on-chain.
- `AffestExecutor` can only call the vault with an allowlisted adapter and
  assets. Approval actions are bound to the strategy owner and an expiry.
- The demo adapter is deliberately fixed-pair and 1:1; it is not presented as
  a production DEX or price oracle.

## Persistence and restart behavior

`CoordinationStore` is the worker's coordination boundary. The in-memory store
is used by deterministic tests. `PostgresCoordinationStore` implements the same
interface with a unique `(source_chain, source_transaction_hash, log_index)`
key, JSON proof storage, lifecycle transition validation, and a durable worker
cursor. A worker can therefore restart without replaying a source event or
losing a proof that is waiting for Creditcoin submission.

## Current implementation boundary

Phases 1–3 are implemented as a protocol/domain/worker vertical slice. There
is intentionally no browser signer, MCP credential endpoint, relayer key, or
live deployment in this slice. Those consumers must use unsigned transaction
previews and the same contract/application boundaries in later phases.

## Phase 4–5 surfaces

The MCP server uses Streamable HTTP and creates a stateless SDK transport per
request. Bearer credentials are HMAC-hashed, revocable, expiry-bound, scoped
(`read`, `plan`, `proof`, `action`), rate-limited, and audit-recorded. Every
action tool is preview-first and idempotent by user plus key.

The dashboard has a dependency-free static preview for constrained environments
and a matching Next App Router source layout. It surfaces testnet status,
allocation drift, strategy guardrails, proof progress, activity, and agent
access without implying that demo balances or undeployed addresses are real.
