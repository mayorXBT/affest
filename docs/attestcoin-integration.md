# Attestcoin integration (Phase 1)

Affest uses Ethereum Sepolia as the source chain and Creditcoin CC3 Testnet as
the destination chain. Sepolia is represented by Attestcoin chain key `1`.
The official Creditcoin BlockProver precompile is configured at
`0x0000000000000000000000000000000000000FD2`; addresses and SDK versions are
recorded in [`research.md`](./research.md).

## Attestcoin Protocol integration summary

Affest uses Attestcoin to verify an Ethereum fact before it lets a Creditcoin
portfolio strategy act.

The flow is:

```text
Ethereum Sepolia event
  -> Attestcoin attestation and proof
  -> Creditcoin proof verification
  -> Affest strategy limits
  -> approved or automatic portfolio action
```

In plain language, the user creates a `PortfolioSignal` event on Ethereum
Sepolia. Affest waits until Attestcoin has attested the source block, then the
worker builds the official proof. The Creditcoin verifier checks that proof and
also checks the source receipt, event contract, event signature, user, asset,
amount, and signal type. The strategy can act only after every check passes.

This keeps the trust boundary clear. The worker and an AI agent can observe,
explain, and prepare an action. They cannot turn an unverified message into
permission to move funds. Creditcoin enforces the user's asset allowlist,
amount limits, allocation rules, expiry, pause state, and replay protection.

The integration uses the official `@gluwa/usc-sdk` proof builder and the
official Creditcoin BlockProver path. The CC3 exchange adapter is a labelled
demo adapter; Attestcoin verification itself is not mocked. See the [one-page
Attestcoin integration summary](../apps/web/public/affest-summary.pdf) for a
judge-friendly overview.

## Proven event

`PortfolioSignalEmitter.emitSignal` emits:

```solidity
event PortfolioSignal(
  bytes32 indexed signalId,
  address indexed user,
  address indexed asset,
  uint256 amount,
  uint8 signalType
);
```

The source contract rejects zero assets, zero amounts, and duplicate signal
IDs. The worker discovers the log and reads the source receipt before asking
Attestcoin for a proof.

## Proof lifecycle

1. `ViemSepoliaSourcePort` discovers a signal and confirms its receipt.
2. `SdkAttestationPort` checks the official attested-height endpoint.
3. Once the block is attested, `@gluwa/usc-sdk@0.18.0` builds a proof.
4. The proof is validated at the TypeScript boundary against the official
   proof-builder response shape (`txBytes`, continuity proof, and Merkle proof).
5. The executor supplies the proof to `AffestAttestationVerifier`.
6. The verifier calls `INativeQueryVerifier.verifyAndEmit` on the official
   precompile, decodes the returned transaction with the official EVM decoder,
   and requires receipt status `1`.
7. It then checks the expected source emitter, event signature, log index, user,
   asset, minimum amount, and signal type. Only after these checks does the
   strategy manager permit a portfolio action.

## Replay protection

The verifier derives a query ID from `(chainKey, blockHeight, txIndex)` and a
processed-event key from `(queryId, receiptLogIndex)`. A second submission of
the same source receipt log reverts with `EventAlreadyProcessed`.

## Reproducibility

The local test suite includes an official-shaped proof fixture and exercises
success, receipt failure, wrong chain/emitter/signature/user/asset/amount/type,
missing log, and replay rejection. A read-only proof inspection command is
available after building the worker:

```powershell
$env:SOURCE_TRANSACTION_HASH="0x..."
$env:ATTESTCOIN_PROOF_API_URL="https://..."
pnpm --filter @affest/worker... build
pnpm --filter @affest/worker proof:inspect
```

This command never signs or submits a transaction. A live CC3 verification
requires a funded testnet deployer, deployed Affest addresses, and RPC access;
no placeholder address is claimed as deployed by this repository.
