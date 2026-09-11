# Affest MVP Implementation Plan

Status: awaiting owner approval
Phase 0 only; implementation must not start until this plan is approved.

## Product boundary

Affest will demonstrate one trustworthy automation loop:

> A user-approved deterministic Creditcoin strategy reacts to a real Ethereum
> Sepolia event only after Attestcoin proof verification, while on-chain policy
> prevents an AI client or relayer from exceeding the user's authority.

The MVP contains one portfolio per wallet, two demo portfolio assets, one source
event, one allocation strategy, three execution modes, one remote MCP server,
and one polished dashboard.

The MVP does not claim production swaps, USD oracle pricing, or cross-chain
writes back to Ethereum.

## Proposed architecture

```text
                            READ / DRAFT / REQUEST
 Human dashboard -------------------------------------------------+
                                                                  |
 MCP clients -> OAuth/scopes -> MCP server -----------------------+
                                                                  v
                                                      Application services
                                                        |      |       |
                                                        |      |       +-> audit log
                                                        |      +----------> PostgreSQL projection
                                                        +-----------------> chain readers
                                                                  |
 Sepolia PortfolioSignal -> persistent worker -> Attestcoin proof |
              |                    |                    |          |
              +--------------------+--------------------+----------+
                                                                  v
 Creditcoin CC3: verifier -> executor -> strategy manager -> vault -> swap adapter
                    |           |             |             |
                    +-----------+-------------+-------------+
                         on-chain authority, limits, and replay protection
```

### Repository shape

```text
apps/
  web/                  Next.js App Router dashboard and user-facing API
  mcp/                  Remote Streamable HTTP MCP server
  worker/               Sepolia monitor, attestation, proof and execution jobs
packages/
  contracts/            Foundry contracts, scripts and Solidity tests
  strategy-engine/      Pure deterministic policy schema and validation
  api-contracts/        Zod DTOs, typed errors and MCP result envelopes
  chain-config/         Chain IDs, chain keys, verified addresses and ABIs
  database/             Drizzle schema, migrations and repositories
  application/          Use cases shared by web, MCP and worker
docs/
```

Dependency direction:

```text
web / mcp / worker
        |
        v
application -> strategy-engine + api-contracts + chain-config + database

contracts is the on-chain authority and exports generated ABIs only.
strategy-engine never imports web, MCP, worker, database, or chain clients.
```

### Contract responsibilities

- `PortfolioSignalEmitter`: minimal Sepolia contract that transfers or records a
  configured demo asset and emits the structured `PortfolioSignal`.
- `AffestVaultFactory`: creates at most one vault per owner for the MVP.
- `AffestVault`: custody, owner deposit/withdraw, emergency pause, and calls to
  one allowlisted adapter; all swap output returns to the vault.
- `AffestStrategyManager`: canonical deterministic policy, state, expiry,
  cooldown, per-action cap, rolling weekly cap, allocations, and execution mode.
- `AffestAttestationVerifier`: extends the official readability base, decodes
  the EVM receipt, validates success/emitter/event/user/asset/amount, and returns
  a bound trigger result.
- `AffestExecutor`: consumes unique event keys, validates policy, either executes
  an eligible automatic action or creates a bound pending approval.
- `ISwapAdapter`: narrow asset-in/asset-out interface with explicit minimum
  output and no arbitrary target or calldata.
- `DemoSwapAdapter`: clearly labelled fixed-rate CC3 demo exchange for the two
  Affest test assets.

### Authority and state ownership

| Concern | Authority |
|---|---|
| Strategy permissions, limits, pause, replay | Creditcoin contracts |
| Asset custody and withdrawal | User-owned Creditcoin vault |
| Source transaction inclusion | Attestcoin proof verification |
| Receipt success and event meaning | Affest verifier contract |
| Monitoring, retries, indexing | Worker and PostgreSQL |
| Natural-language interpretation | Draft provider only |
| Executable deterministic policy | User-reviewed and signed on-chain data |
| MCP credential state | Server-side credential store; hash only |

### Proof and execution state machine

```text
DETECTED
  -> SOURCE_CONFIRMED
  -> WAITING_FOR_ATTESTATION
  -> PROOF_READY
  -> PROOF_SIMULATED
  -> CREDITCOIN_SUBMITTED
  -> VERIFIED
       -> AUTO_EXECUTED
       -> APPROVAL_PENDING -> USER_APPROVED -> EXECUTED

Every non-terminal state may become RETRYABLE_FAILED or TERMINAL_REJECTED.
Duplicate worker delivery returns the existing record instead of submitting again.
```

For an above-limit hybrid action, the proof-verifying transaction creates an
on-chain pending action bound to the verified event. Later user approval consumes
that action. It does not resubmit the already-consumed proof.

## Exact MVP implementation plan

### Phase 1 — real proof vertical slice

1. Scaffold the pnpm workspace and isolated Foundry project with pinned versions
   from `docs/research.md`.
2. Add checked chain configuration for Sepolia and CC3; reject missing or
   mismatched chain IDs at startup.
3. Implement and test `PortfolioSignalEmitter`.
4. Implement the smallest Creditcoin proof consumer using official
   `ASCBase`/`EvmV1Decoder`.
5. Validate receipt success, emitter, event signature, original log index, user,
   asset, amount, and signal type.
6. Add a script that accepts the official SDK `0.18.0` proof response shape,
   simulates the Creditcoin call, and submits only after a successful simulation.
7. Deploy the source contract to Sepolia and proof consumer to CC3.
8. Emit one real Sepolia signal, wait for attestation, generate the real proof,
   verify it on CC3, and record both transaction hashes.
9. Submit the same source event again and record the on-chain replay rejection.

Exit gate: a judge-reproducible real proof transaction and replay rejection exist.
No dashboard work begins before this gate passes.

### Phase 2 — strategy and vault contracts

1. Add the vault factory, vault, strategy manager, verifier, executor, adapter
   interface, demo adapter, and two labelled test assets.
2. Encode one allocation strategy with integer token units and weights totalling
   exactly 10,000 basis points.
3. Implement approval, restricted automatic, and hybrid paths.
4. Enforce source chain/emitter/event, assets, adapter, per-action cap, rolling
   weekly cap, auto cap, slippage, allocation bounds, expiry, cooldown, pause,
   policy version/nonce, executor role, and event replay on-chain.
5. Bind pending approvals to strategy, event, action hash, amount, and expiry.
6. Add complete contract events and adversarial Foundry tests.
7. Recheck the CC3 DEX evidence gate. Keep `DemoSwapAdapter` unless every
   requirement in `docs/research.md` is demonstrated.

Exit gate: the complete contract test suite passes, including tampered proof
inputs, unauthorized targets, limit boundaries, replay, pause, expiry, and
reentrancy.

### Phase 3 — database, application services, and worker

1. Add Drizzle schemas for users, portfolios, strategies, credential hashes,
   trigger events, proposed actions, executions, idempotency, and audit entries.
2. Implement shared application use cases so dashboard and MCP cannot diverge.
3. Implement a persistent Sepolia cursor with confirmation policy, restart
   catch-up, reorg handling, and unique `(chain, txHash, logIndex)` records.
4. Implement attestation polling with bounded retries and explicit terminal
   errors.
5. Persist the official proof shape, run `eth_call` simulation, and coordinate
   Creditcoin submission.
6. Reconcile database projections from Creditcoin events; never mark execution
   complete from a relayer response alone.
7. Add structured redacted logs and operational health endpoints.

Exit gate: restart, duplicate delivery, RPC failure, delayed attestation, failed
simulation, and replacement transaction tests pass.

### Phase 4 — remote MCP server

1. Expose canonical Streamable HTTP at `/mcp` using the current official SDK.
2. Implement OAuth 2.1 discovery/PKCE/resource binding for hosted clients;
   retain local bearer credentials only behind a development flag.
3. Store credential lookup hashes, scopes, expiry and revocation; never store or
   log the raw credential after initial display.
4. Add rate limits, Origin validation, protocol-version validation, audit
   records, consistent typed errors, and idempotency on mutations.
5. Implement the requested read tools, then planning tools, proof tools, and
   action tools against the shared application services.
6. Make dangerous tools return a preview/unsigned transaction. The sole
   exception queues an automatic request that still succeeds only if the
   on-chain policy authorizes it.
7. Test tool discovery, schemas, auth/scopes, revocation, rate limits,
   idempotency, approval boundaries, error mapping, and secret redaction.
8. Test against one selected Claude client and one selected OpenAI-compatible
   client. Add legacy transport only if an actual selected client requires it.

Exit gate: both selected clients can read the same portfolio and request the
same constrained action without receiving signing authority.

### Phase 5 — dashboard

1. Build wallet onboarding, CC3 network checking, vault creation, deposits and
   owner withdrawals.
2. Build the six-step strategy flow: describe, inspect deterministic draft,
   edit, set limits, choose mode, review permissions, sign.
3. Build overview, portfolio, strategies, activity, agents, and settings using
   real application and contract state.
4. Build every specified empty, loading, wrong-network, proof lifecycle,
   approval, execution, failure, credential, and emergency-pause state.
5. Make “Waiting for Attestcoin” a persistent staged timeline with timestamps,
   retry status, and links rather than an indefinite spinner.
6. Add responsive and accessibility tests, transaction failure recovery, stale
   state handling, double-submit prevention, and mobile flows.

Exit gate: the dashboard and MCP show identical portfolio, strategy, trigger,
proof, and execution state.

### Phase 6 — integration, deployment, and handoff

1. Deploy web, MCP, worker, database, Sepolia source, and Creditcoin contracts.
2. Run the complete real-proof demo twice: once below and once above the hybrid
   automatic limit.
3. Demonstrate replay rejection and emergency pause.
4. Finish the README, architecture, Attestcoin, MCP, security, and demo runbook
   documents with real addresses, explorer links, commands, screenshots, and
   known limitations.
5. Run secret scanning, Foundry tests, TypeScript tests, lint, type checking,
   production builds, MCP client tests, frontend tests, and the deployed E2E.

Exit gate: a new operator can reproduce the demo from documentation without
private guidance.

## Test strategy

| Layer | Framework | Required focus |
|---|---|---|
| Solidity unit/integration | Foundry | proof shape, event decoding, policy limits, auth, replay, reentrancy |
| TypeScript unit/integration | Vitest | schemas, state machines, idempotency, auth, worker retries, error mapping |
| Browser E2E | Playwright | wallet/network states, strategy review, approval, attestation timeline, agents |
| MCP protocol integration | official SDK client + Vitest | discovery, strict schemas, scopes, transport, action boundaries |
| Strategy-draft eval | provider-independent fixture suite | supported vocabulary, exact 10,000 bps, limits, no arbitrary targets |
| Deployed E2E | scripts plus recorded hashes | real Sepolia event, proof, CC3 verification/action, replay rejection |

The LLM evaluation set must include malformed values, prompt injection,
unsupported assets/chains, arbitrary calldata requests, unlimited automation,
unsafe slippage, conflicting rules, and ambiguous instructions. Invalid output
must become a non-executable draft error.

## Failure controls

| Failure | Control | User-visible result |
|---|---|---|
| Sepolia RPC timeout/reorg | confirmation depth, persisted cursor, retry | delayed/source-rechecking state |
| Attestation not ready | bounded polling and backoff | waiting stage with next retry |
| Proof API returns malformed data | strict schema and no submission | proof rejected with reason |
| Proof valid but receipt failed | on-chain `receiptStatus == 1` | terminal rejection |
| Wrong emitter/event/user/asset | on-chain semantic checks | terminal rejection |
| Duplicate worker job | DB idempotency plus on-chain event key | existing result/replay rejected |
| Relayer compromised | executor-only role and on-chain caps | unauthorized action reverts |
| MCP client compromised | scopes, rate limit, revocation, no signing | preview or policy-limited request |
| Database compromised | on-chain authority and event reconciliation | no new spending authority |
| User approves stale action | action expiry and bound action hash | approval reverts |
| DEX unavailable | adapter isolation and honest demo adapter | no claim of production swap |
| LLM emits unsafe policy | closed schema plus deterministic validation | draft rejected before signing |

No planned failure path should be silent. Exact error copy and recovery actions
will be specified with each implementation slice.

## Delivery order and parallel work

Phase 1 is deliberately sequential because the official proof shape must anchor
every downstream interface. After that gate:

| Lane | Work | Dependency |
|---|---|---|
| A | Strategy contracts and Foundry tests | Phase 1 |
| B | Strategy engine, API contracts, DB schema | Phase 1 proof fixtures |
| C | Dashboard visual system and static state catalogue | approved architecture |
| D | MCP protocol/auth spike | approved architecture |

Merge A and B before completing the worker. MCP tools and dashboard data wiring
then proceed against the same application services. Static visual work may run
in parallel but cannot invent backend state.

## Explicitly not in scope

- Multiple source chains: one real chain is enough to prove the trust model.
- Cross-chain writes back to Ethereum: not currently supported by the audited
  example path.
- Production bridge or production DEX: neither is needed to prove authorization.
- USD oracle pricing: no verified CC3 oracle was established in Phase 0.
- More than two assets or one strategy type: increases test surface without
  strengthening the proof.
- Social/copy trading, DAO governance, subscriptions, NFTs, backtesting, mobile
  apps, and advanced yield or prediction systems: outside the hackathon wedge.
- Redis/BullMQ and Turborepo: add only if measured operational needs justify them.

## Risks and blocked dependencies

1. The official hackathon page, deadline, and final judging rubric still need a
   supplied organizer URL.
2. CC3 DEX contracts/assets/liquidity are not sufficiently documented for a
   reliable demo.
3. Attestation latency is external and must be rehearsed before recording.
4. MCP's latest transport revision may be ahead of some client implementations;
   compatibility must be tested, not assumed.
5. OAuth increases Phase 4 scope but is the safer path to native hosted-client
   interoperability.
6. Automatic “$500” limits are not honest without an oracle; the proposed MVP
   uses demo stable-token base units.
7. The selected strategy draft LLM/provider is not yet chosen.
8. Deployment requires funded Sepolia and CC3 accounts and secure relayer
   secret provisioning.
9. The current Glider dashboard was unavailable during discovery, so visual
   benchmarking must be repeated before Phase 5.

## Approval decisions

Phase 1 remains blocked until the owner approves or changes these decisions:

1. Use the architecture and phase gates in this document.
2. Use a clearly labelled `DemoSwapAdapter` and two Affest test tokens unless the
   Phase 2 DEX evidence gate passes.
3. Express MVP limits in demo stable-token integer units, not claimed USD.
4. Implement OAuth 2.1 for hosted MCP; allow bearer tokens only in local
   development.
5. Use pnpm without Turborepo, Hono, Drizzle/PostgreSQL, Vercel for web, and a
   persistent Node host for MCP/worker.
6. Select the strategy-draft provider and the exact Claude and OpenAI-compatible
   clients for acceptance testing.
7. Provide the official BUIDL CTC 2026 Fall organizer page if it exists.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|---|---|---|---:|---|---|
| CEO Review | `/plan-ceo-review` | Scope and strategy | 0 | Not run | Optional before implementation |
| Codex Review | `/codex review` | Independent second opinion | 0 | Not run | Optional |
| Eng Review | `/plan-eng-review` | Architecture and tests | 1 | Issues open | Seven owner decisions remain |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | Deferred | Run before Phase 5 |
| DX Review | `/plan-devex-review` | Developer experience | 0 | Not run | Optional |

**VERDICT:** Phase 0 is complete; Phase 1 is blocked on explicit owner approval.

**UNRESOLVED DECISIONS:**

- Architecture and phase gates.
- Demo swap boundary.
- Token-unit limit semantics.
- OAuth posture.
- Workspace, service, database, and hosting choices.
- Strategy-draft provider and MCP acceptance clients.
- Official hackathon organizer URL.
