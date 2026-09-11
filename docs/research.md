# Affest Phase 0 Research

Status: completed 2026-09-08
Scope: discovery only; no product implementation or deployment has started.

## Executive conclusion

Affest's proposed trust model is feasible with the current Attestcoin
readability stack:

```text
Ethereum Sepolia transaction
  -> Attestcoin attestation
  -> proof generation
  -> proof verification and receipt decoding on Creditcoin CC3
  -> deterministic strategy checks
  -> Creditcoin portfolio state change
```

The final state change should remain on Creditcoin. The current official
example repository describes cross-chain writability as upcoming, not as an
audited capability ready for this demo.

The unresolved infrastructure gap is portfolio swapping. Creditcoin documents
Penguinswap as an ecosystem DEX, but the reviewed official material does not
publish a dependable CC3 testnet router, quoter, verified token set, or liquidity
guarantee. The MVP should therefore put swaps behind `ISwapAdapter` and begin
with a visibly labelled demo adapter. Attestcoin verification must remain real.

## 1. Repository assessment

The repository is effectively greenfield:

- Git is initialized on `main`.
- There are no commits, application files, contracts, package manifests, tests,
  README, or architecture documents.
- `AGENTS.md` and the local `.agents/` instruction bundle are the only
  project-level inputs.
- There is no existing structure to preserve or migrate.

Recommendation: use a pnpm workspace without Turborepo initially. The MVP has
three Node applications and a Foundry package, but pnpm recursive scripts are
sufficient until build orchestration becomes a measured problem.

## 2. Official Attestcoin findings

### Current product boundary

- Attestcoin was previously documented as Universal Smart Contracts (USC).
- The official examples currently cover cross-chain readability.
- The examples state that full writability examples are planned after the
  writability core audit. Affest must not claim or depend on arbitrary
  Attestcoin-triggered writes back to Ethereum.
- A Creditcoin application contract can synchronously verify an included source
  transaction and then run application logic in the same Creditcoin
  transaction.

### What a proof establishes

`BlockProver` establishes transaction inclusion in an attested source-chain
block and continuity to the attested checkpoint. It does not establish that the
source transaction succeeded or that a specific application event is valid.

Affest must independently require all of the following after proof verification:

1. The configured source-chain key.
2. A supported EVM transaction/receipt encoding.
3. `receiptStatus == 1`.
4. The configured source contract as the log emitter.
5. The exact `PortfolioSignal` event signature.
6. The expected topic and data shape.
7. The strategy owner/user, asset, signal type, and minimum amount.
8. A unique, unused source event.

Replay prevention belongs to Affest. The event key should include the verified
query identifier and original receipt-log index so two legitimate signals in
one source transaction remain distinguishable:

```text
eventKey = keccak256(queryId, receiptLogIndex)
```

### Current SDK and contract packages

Verified through the official examples and npm registry on 2026-09-07:

| Package | Version | Notes |
|---|---:|---|
| `@gluwa/usc-sdk` | `0.18.0` | Current package name still uses USC; TypeScript/JavaScript; ethers v6 |
| `@gluwa/asc-contracts` | `0.2.1` | Official readability base contracts and EVM decoder |
| `@modelcontextprotocol/sdk` | `1.30.0` | Current MCP TypeScript SDK; Node.js 18+ |
| `openzeppelin-contracts` | `5.4.0` | Version pinned by the current Attestcoin example workspace |
| Foundry | `1.2.3` | Version recommended by the current Attestcoin examples |

The official Attestcoin SDK is composed around:

- `ProofBuilder`
- `PrecompileChainInfoProvider`
- `PrecompileBlockProver`

The verified single-proof flow is:

1. Resolve or configure the source `chainKey`.
2. Wait until the source block height is attested.
3. Request the proof for the source transaction.
4. Simulate verifier execution on Creditcoin.
5. Submit the Creditcoin transaction.

The current proof-builder response contains:

- `chainKey`
- `headerNumber`
- `txIndex`
- `txHash`
- `txBytes`
- `merkleProof`
- `continuityProof`
- `cached`
- `generatedAt`

The SDK's current proof service paths are:

```text
GET  /api/v1/proof-by-tx/{chainKey}/{txHash}
POST /api/v1/proof-batch-by-tx/{chainKey}
GET  /api/v1/attested-height/{chainKey}
```

The official contracts expose single and batch verification. The MVP only
needs single-proof verification.

### Official Creditcoin precompiles

| Contract | CC3 address |
|---|---|
| BlockProver / native query verifier | `0x0000000000000000000000000000000000000FD2` |
| ChainInfo | `0x0000000000000000000000000000000000000fd3` |
| EVM V1 Decoder | `0x731c345d79Fb8BbDC541f9DF3b6317585F849F9f` |

Address casing is not semantically significant, but configuration should store
checksum-normalized addresses.

`ASCBase` from `@gluwa/asc-contracts` already calculates the query identifier,
rejects reused query identifiers, invokes the verifier, and dispatches verified
transaction bytes to an application hook. Affest should reuse that base instead
of recreating Merkle and continuity verification.

## 3. Confirmed network configuration

### Creditcoin CC3 Testnet

| Field | Verified value |
|---|---|
| EVM chain ID | `102031` |
| HTTPS RPC | `https://rpc.cc3-testnet.creditcoin.network` |
| WSS RPC | `wss://rpc.cc3-testnet.creditcoin.network` |
| EVM explorer | `https://creditcoin-testnet.blockscout.com/` |
| Native test token | `TCTC` / `tCTC`, 18 decimals |
| Attestcoin dashboard | `https://dashboard.cc3-testnet.creditcoin.network/` |
| Proof service, preferred | `https://prover.cc3-testnet.creditcoin.network` |
| Proof service, documented alias | `https://proof-gen-api.cc3-testnet.creditcoin.network/` |

The preferred proof URL matches the current SDK documentation and live API.
Keep it configurable rather than treating either hostname as a protocol
constant.

### Ethereum Sepolia

| Field | Verified value |
|---|---|
| EVM chain ID | `11155111` |
| Attestcoin source chain key | `1` |
| Attestcoin genesis height | `0` |

Use a project-supplied `SEPOLIA_RPC_URL`. A public Creditcoin proxy endpoint is
listed by the official network API, but the demo should not depend on an
uncontrolled public proxy.

Ethereum Mainnet is also listed by Attestcoin with chain key `3`, but it is
outside the MVP.

### Live-service observation

On 2026-09-07, the proof service health endpoint reported both CC3 and Ethereum
RPC connectivity as healthy, and the Sepolia attested-height endpoint returned
a current height. The height is intentionally not recorded as configuration
because it changes continuously.

## 4. MCP protocol findings

The latest stable MCP specification reviewed is dated 2026-07-28.

The canonical remote transport is Streamable HTTP. In the 2026-07-28 revision:

- Clients send each JSON-RPC message as an HTTP `POST` to one MCP endpoint.
- The response may be JSON or request-scoped SSE.
- The older standalone HTTP+SSE transport is deprecated.
- The server must validate `Origin`.
- HTTPS and authorization are required for the deployed service.
- Current protocol headers include `MCP-Protocol-Version`, `Mcp-Method`, and
  `Mcp-Name`.

Affest should expose `/mcp` as the canonical endpoint. A legacy `/sse`
compatibility endpoint should only be added if an actual target client still
requires it; it must not replace the canonical transport.

For authorization, the MCP specification treats the server as an OAuth resource
server and specifies OAuth 2.1 discovery, PKCE, resource indicators, and bearer
tokens in the `Authorization` header. OpenAI's current MCP guidance recommends
OAuth for connected services and supports Client ID Metadata Documents.

Recommendation: implement OAuth 2.1 for the judge-facing hosted MCP connection,
with revocable, scoped credentials underneath. A temporary bearer-token mode may
be useful for local protocol tests, but bearer-only interoperability with every
Claude or ChatGPT surface is not confirmed.

No MCP action may accept arbitrary calldata or expose signing material.

## 5. Glider product research

The official Glider documentation confirms these useful product patterns:

- A non-custodial portfolio abstraction.
- User-signed enrollment and withdrawal steps.
- Prepare/submit transaction flows.
- Idempotent mutations and asynchronous operation polling.
- Explicit start and stop controls for automation.
- Positions, performance, and strategy status as separate concepts.

Affest should reuse those interaction principles, not Glider's copy, branding,
assets, or exact layout.

The current authenticated Glider dashboard could not be reliably inspected:
`app.glider.fi` returned a Cloudflare DNS error during research. Claims about
its current visual layout are therefore intentionally excluded. A fresh visual
review remains a precondition for Phase 5, not for the proof vertical slice.

## 6. Creditcoin DEX and asset findings

Official Creditcoin documentation identifies Penguinswap as a Creditcoin
ecosystem DEX and documents:

- token swaps;
- quoted previews;
- configurable slippage;
- liquidity pools;
- fee tiers; and
- concentrated or full-range liquidity UX.

The reviewed official documentation does not provide enough evidence for a
reliable CC3 testnet integration:

- no official CC3 router address;
- no official CC3 factory or quoter address;
- no verified CC3 token-contract list beyond native TCTC;
- no documented stable/risk test pair;
- no liquidity depth or reliability guarantee; and
- no reproducible CC3 quote-and-simulation example.

Therefore:

- Do not invent a router or token address.
- Define a narrow `ISwapAdapter`.
- Initially deploy two clearly labelled Affest demo ERC-20s and a deterministic
  `DemoSwapAdapter` on CC3.
- Keep the vault, strategies, limits, proof verification, replay protection,
  approval, and automatic execution real.
- Re-run a DEX go/no-go check before Phase 2. Replace the demo adapter only if
  official deployment addresses, verified bytecode/source, a successful quote,
  a successful simulation, and adequate test liquidity are all demonstrated.

This boundary means the demo proves cross-chain authorization and constrained
portfolio automation, not production price discovery.

## 7. Security implications discovered in Phase 0

- The database is never the authority for permission or completed execution.
- A proof cannot be treated as a successful transaction without decoding
  `receiptStatus`.
- Filtering logs by signature alone can lose the original receipt-log index;
  the verifier should scan the decoded receipt logs and retain that index.
- A proof-backed pending action must bind `eventKey`, `strategyId`, action hash,
  amount, and expiry. User approval then consumes the pending action without
  asking the same proof to pass replay protection twice.
- Automatic limits cannot honestly be denominated in USD without a verified
  price source. For the MVP, caps should use integer base units of the demo
  stable asset, which the UI must label as test units rather than market USD.
- The relayer can call only the executor. It must never receive an unrestricted
  vault withdrawal role.
- Worker retries and MCP mutations require independent idempotency keys.

## 8. Confirmed facts, assumptions, and open verification

### Confirmed

- Sepolia is supported as Attestcoin source chain key `1`.
- Creditcoin CC3 uses EVM chain ID `102031`.
- The official verifier and ChainInfo precompile addresses above are current.
- The official SDK and contract package versions above are current.
- Attestcoin proves inclusion/continuity; Affest must validate receipt success
  and event semantics.
- Streamable HTTP is the current MCP remote transport.
- Current official examples do not present writability as ready.

### Proposed, pending owner approval

- pnpm workspace without Turborepo.
- Hono for the MCP HTTP service.
- Supabase-hosted PostgreSQL with Drizzle.
- Vercel for the web app and one persistent Node provider for MCP and worker.
- OAuth 2.1 for hosted MCP; local bearer tokens only as a development aid.
- Demo test tokens and `DemoSwapAdapter` until the DEX evidence gate passes.
- Stable-asset base units, not oracle-derived USD, for MVP limits.

### Blocked or not independently verified

- An official public page for the named “BUIDL CTC 2026 Fall” event and its
  submission deadline/rubric was not discoverable during this research. The
  project brief is treated as the requirement, but the organizer URL is needed
  before making deadline or judging claims.
- Production-ready CC3 testnet DEX addresses and liquidity are not documented.
- Native-client OAuth behavior must be tested against the exact Claude and
  ChatGPT surfaces selected for the demo.
- Deployments require funded Sepolia and CC3 accounts; no keys or funds were
  requested or used in Phase 0.

## 9. Primary sources

### Attestcoin and Creditcoin

- [Attestcoin documentation index](https://docs.attestcoin.org/llms.txt)
- [Attestcoin SDK](https://docs.attestcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-sdk-usc-sdk.md)
- [Supported chains and environments](https://docs.attestcoin.org/attestcoin-protocol/attestcoin-protocol-chains-environments.md)
- [Attestcoin testnet](https://docs.attestcoin.org/attestcoin-protocol/environments/testnet.md)
- [Attestcoin smart contracts](https://docs.attestcoin.org/attestcoin-protocol/dapp-builder-infrastructure/attestcoin-smart-contracts.md)
- [Source-chain contract guidance](https://docs.attestcoin.org/attestcoin-protocol/dapp-builder-infrastructure/source-chain-smart-contracts.md)
- [Off-chain workers](https://docs.attestcoin.org/attestcoin-protocol/dapp-builder-infrastructure/offchain-readability-workers.md)
- [Official examples](https://github.com/gluwa/attestcoin-protocol-examples)
- [CC3 Testnet configuration](https://docs.creditcoin.org/environments/testnet.md)
- [Creditcoin network API](https://api.creditcoin.org/network/v1/networks/evm)
- [Creditcoin DEX overview](https://docs.creditcoin.org/dex/general.md)
- [Creditcoin swap guide](https://docs.creditcoin.org/swap-ctc-quick-guide.md)

### MCP and product baseline

- [MCP Streamable HTTP transport, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http.md)
- [MCP authorization, 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization/index.md)
- [OpenAI MCP guidance](https://developers.openai.com/api/docs/mcp)
- [Glider documentation](https://docs.glider.fi/)

### Package registries

- [`@gluwa/usc-sdk` latest metadata](https://registry.npmjs.org/@gluwa%2fusc-sdk/latest)
- [`@gluwa/asc-contracts` latest metadata](https://registry.npmjs.org/@gluwa%2fasc-contracts/latest)
- [`@modelcontextprotocol/sdk` latest metadata](https://registry.npmjs.org/@modelcontextprotocol%2fsdk/latest)
