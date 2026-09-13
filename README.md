# Affest

Verified cross-chain automation for self-driving portfolios.

Affest is a non-custodial portfolio automation prototype for the BUIDL CTC
2026 Fall hackathon. A human creates a deterministic portfolio policy in the
dashboard. An MCP-compatible agent can read the policy, inspect source-chain
activity, prepare an action, or request a guarded execution. The Creditcoin
contracts enforce the final permission boundary.

An Ethereum event is never trusted because the worker or an AI agent reports
it. A valid Attestcoin proof must pass the Creditcoin verifier before the
strategy manager or executor can act.

## Current status

The repository contains the dashboard, MCP server, worker, strategy engine,
database model, and Foundry contracts. The dashboard supports a clearly
labelled local preview session and an injected-wallet path for Creditcoin CC3
Testnet. The swap adapter is a labelled fixed-rate demo adapter because a
reliable CC3 DEX route was not confirmed.

The live proof flow remains a testnet integration. Do not treat preview
balances, demo swaps, or testnet deployments as financial infrastructure.

## Judge materials

- [Attestcoin Protocol Integration Summary](https://affest.cefo.dev/affest-summary.pdf)
- [Affest One-Page Litepaper](https://affest.cefo.dev/affest-whitepaper.pdf)

## Repository layout

```text
apps/web        Next.js dashboard and strategy builder
apps/mcp        Remote Streamable HTTP MCP server
apps/worker     Source-event monitor and proof orchestration worker
packages/contracts      Solidity contracts and Foundry tests
packages/strategy-engine Deterministic policy validation
packages/application    Approval and execution boundary
packages/database       Drizzle schema and coordination stores
packages/chain-config    Verified chain configuration
packages/api-contracts   Shared API and proof schemas
docs             Research, architecture, security, and demo runbooks
```

## Requirements

- Node.js 22 or newer
- pnpm 10
- Foundry for contract tests
- A funded testnet wallet only when using live chain flows

## Install and verify

```powershell
pnpm install
pnpm check
pnpm build
```

`pnpm check` runs TypeScript checks, unit tests, and Foundry tests. The
dashboard build uses Next.js. The MCP and worker builds produce TypeScript
output under their local `dist` directories.

## Run the dashboard

```powershell
pnpm --filter @affest/web dev
```

Open [http://localhost:3000](http://localhost:3000). The disconnected view is
empty by design. Select **Use preview wallet** to inspect the sample vault.
Preview actions do not sign or submit transactions.

The hosted dashboard is [https://affest.cefo.dev](https://affest.cefo.dev).
Set `NEXT_PUBLIC_APP_URL` to that value in Vercel. Set
`NEXT_PUBLIC_MCP_BASE_URL` to the origin of the hosted MCP service. Leave it
empty only when your reverse proxy serves `/health`, `/credentials`, and `/mcp`
from `affest.cefo.dev`.

## Run the MCP server

Set a local bootstrap token and token-hash secret in the process environment.
Never commit either value.

```powershell
$env:MCP_BOOTSTRAP_TOKEN = 'replace-with-a-local-bootstrap-token'
$env:MCP_TOKEN_HASH_SECRET = 'replace-with-a-long-random-secret'
pnpm --filter @affest/mcp dev
```

The server exposes:

- Health: `http://localhost:8787/health`
- MCP: `http://localhost:8787/mcp`
- Credential bootstrap: `POST http://localhost:8787/credentials`

Credentials are bearer tokens. The server stores only an HMAC hash and
supports scopes, expiry, revocation, idempotency keys, audit records, and a
per-credential rate limit. Dangerous tools return a preview or unsigned
transaction unless an on-chain policy authorizes execution.

## Environment

Copy `.env.example` to `.env` and fill in only local or deployment-specific
values. The repository ignores `.env` and `.env.local`. Never put a private key
in a `NEXT_PUBLIC_` variable or in an MCP response.

Verified chain IDs, RPC requirements, Attestcoin chain keys, precompile details,
SDK versions, deployed addresses, and CC3 DEX findings are recorded in
[`docs/research.md`](docs/research.md) and [`docs/deployments.md`](docs/deployments.md).
The persistent trigger/proof worker is deployed separately; see
[`docs/worker-deploy.md`](docs/worker-deploy.md).

The browser reads public RPC and contract overrides from the `NEXT_PUBLIC_*`
entries in `.env.example`. Add the same values to the Vercel project when the
deployment should use addresses other than the documented testnet defaults.

## Architecture

```text
Ethereum Sepolia event
        |
        v
Attestcoin attestation and proof
        |
        v
Creditcoin verifier -> strategy policy -> vault action
```

The worker monitors the source event and coordinates proof readiness. The MCP
server exposes the same planning and proof boundaries to agents. The database
indexes coordination state for the dashboard; it never overrides on-chain
permissions or execution results.

See [`docs/architecture.md`](docs/architecture.md) for module boundaries and
[`docs/attestcoin-integration.md`](docs/attestcoin-integration.md) for the
proof lifecycle and reproduction steps.

## Execution modes

- **Approval:** prepare an unsigned action for the portfolio owner to sign.
- **Automatic:** execute only when the on-chain policy, limits, and verified
  proof authorize the action.
- **Hybrid:** execute below the user limit and request approval above it.

The agent never receives a private key and cannot submit arbitrary calldata.

## Contracts

The Foundry package contains the vault, strategy manager, Attestcoin verifier
adapter, executor, vault factory, source signal emitter, demo assets, and demo
swap adapter. Run contract tests with:

```powershell
pnpm --filter @affest/contracts test
```

The final demo must use a real Attestcoin verification path. Mocks are limited
to isolated unit tests. The exchange mechanism remains simulated until a
supported CC3 DEX route and test liquidity are confirmed.

## Security boundary

Affest is testnet software, not a custody service. It does not request seed
phrases or private keys from the browser. Automatic execution is restricted by
allowlists, amount caps, cumulative limits, expiry, pause state, nonce and
replay protection, source receipt success, event identity, and Attestcoin
verification.

Read [`docs/security.md`](docs/security.md) before using a funded wallet and
[`docs/demo-runbook.md`](docs/demo-runbook.md) before running the cross-chain
demo.

## Known limitations

- Preview dashboard values are local sample data.
- The local MCP provider is deterministic demo state until a persistent
  application provider is configured.
- The CC3 exchange adapter is simulated.
- Live proof orchestration depends on funded testnet accounts and the current
  Attestcoin service.
- Testnet contracts and RPC endpoints can change.

## License

No production license has been selected yet. Treat this repository as
hackathon source code until a license file is added.
