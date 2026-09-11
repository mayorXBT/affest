# Phase 1–3 local demo runbook

This runbook exercises the complete local vertical slice without pretending to
have a live chain deployment.

1. Install the pinned workspace dependencies with pnpm.
2. Run `pnpm test` to execute the 35 Foundry tests plus TypeScript suites.
3. Run `pnpm typecheck` and `pnpm build`.
4. Review the proof boundary fixture in
   `packages/api-contracts/test/proof.test.ts`.
5. Review the verifier adversarial cases in
   `packages/contracts/test/AffestAttestationVerifier.t.sol`.
6. Review worker restart/idempotency behavior in
   `apps/worker/test/worker.test.ts`.

For a testnet walkthrough, deploy `PortfolioSignalEmitter` on Sepolia and the
Creditcoin contracts with Foundry, configure the addresses in a private
environment, create a signal, wait for the attested height, run
`apps/worker` or `proof:inspect`, and submit through the executor. Record both
transaction hashes and the proof metadata in a local, uncommitted artifact.

The DEX exchange mechanism remains the labelled `DemoSwapAdapter` until an
officially documented CC3 router, quote path, and reliable liquidity are
available. Attestcoin verification itself is not mocked in the integration
boundary.
