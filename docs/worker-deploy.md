# Affest worker deployment

The worker is a separate long-running process. Vercel only serves the
dashboard; the MCP service does not monitor Sepolia by itself.

## Render background worker

Create a **Background Worker** in Render from the same repository:

- Root directory: repository root
- Build command: `pnpm install --frozen-lockfile && pnpm --filter @affest/worker build`
- Start command: `pnpm --filter @affest/worker start`

Do not prepend `corepack enable`: Render's filesystem can reject Corepack's
attempt to replace `/usr/bin/pnpm`.

Set these variables on the worker only:

```text
DATABASE_URL=<Neon pooled connection string>
SEPOLIA_RPC_URL=<Sepolia RPC URL>
CREDITCOIN_RPC_URL=https://rpc.cc3-testnet.creditcoin.network
ATTESTCOIN_PROOF_API_URL=https://prover.cc3-testnet.creditcoin.network
SOURCE_SIGNAL_CONTRACT_ADDRESS=<deployed Sepolia source contract>
AFFEST_ATTESTATION_VERIFIER_ADDRESS=<deployed CC3 verifier>
AFFEST_STRATEGY_MANAGER_ADDRESS=<deployed CC3 strategy manager>
AFFEST_EXECUTOR_ADDRESS=<deployed CC3 executor>
RELAYER_PRIVATE_KEY=<dedicated funded relayer key; never expose to Vercel/MCP>
WORKER_STRATEGY_ID=<active on-chain strategy id, for example 1>
WORKER_START_BLOCK=<Sepolia deployment block for the source contract>
WORKER_INTERVAL_MS=15000
ATTESTCOIN_SOURCE_CHAIN_KEY=1
```

The worker creates `affest_worker_triggers` and
`affest_worker_cursors` in Neon on first start. It resumes from the cursor
after a restart and deduplicates `(source_chain, source_transaction_hash,
log_index)` before requesting a proof.

## One-time contract role wiring

The worker deliberately refuses to start unless the deployed contracts are
wired to the executor. The administrator account that deployed the contracts
must run these calls once (with the addresses from the deployment):

```powershell
cast send $AFFEST_STRATEGY_MANAGER_ADDRESS "setExecutor(address)" $AFFEST_EXECUTOR_ADDRESS --rpc-url $CREDITCOIN_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
cast send $AFFEST_ATTESTATION_VERIFIER_ADDRESS "setAuthorizedCaller(address)" $AFFEST_EXECUTOR_ADDRESS --rpc-url $CREDITCOIN_RPC_URL --private-key $DEPLOYER_PRIVATE_KEY
```

Do not put the deployer key in Render, Vercel, Neon, or an MCP credential.
Use a dedicated relayer key for `RELAYER_PRIVATE_KEY`; it only submits the
proof-backed executor call and cannot withdraw from a vault.

## Execution behavior

1. The worker indexes `PortfolioSignal` logs from the configured Sepolia
   source contract.
2. It rejects reverted source receipts and waits until Attestcoin has
   attested the source block.
3. It builds the official proof, validates its shape, simulates the CC3
   executor call, and submits it.
4. Approval-mode and over-limit hybrid actions are stored as
   `approval-pending`; the MCP returns an unsigned owner `approveRebalance`
   transaction.
5. Automatic and under-limit hybrid actions execute in the same verified
   transaction, subject to the on-chain strategy limits.

The current `DemoSwapAdapter` is intentionally a 1:1 testnet exchange
adapter. The proof, verification, policy checks, replay protection, and CC3
state change are real; only the asset exchange mechanism is simulated.
