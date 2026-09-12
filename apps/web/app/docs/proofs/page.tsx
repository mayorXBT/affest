import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsProofsPage() {
  return (
    <DocsArticle
      title="Proofs"
      lede="A Sepolia PortfolioSignal is an observation. Affest does not rebalance from a log, a database row, or an MCP reply."
    >
      <h2>The event</h2>
      <p>
        <code>PortfolioSignalEmitter.emitSignal</code> on Sepolia emits:
      </p>
      <pre>{`event PortfolioSignal(
  bytes32 indexed signalId,
  address indexed user,
  address indexed asset,
  uint256 amount,
  uint8 signalType
);`}</pre>
      <p>
        The source contract rejects zero assets, zero amounts, and duplicate signal IDs. The worker discovers the log and reads the source receipt before asking Attestcoin for a proof. Sepolia is Attestcoin chain key <code>1</code>.
      </p>

      <h2>Proof lifecycle</h2>
      <ol>
        <li>The Sepolia source port finds the log and confirms receipt status <code>0x1</code>.</li>
        <li>The attestation port checks the official attested-height endpoint.</li>
        <li>Once the block is attested, <code>@gluwa/usc-sdk@0.18.0</code> builds a proof.</li>
        <li>TypeScript validates the proof-builder shape: <code>txBytes</code>, continuity proof, and Merkle proof.</li>
        <li>The executor supplies that proof to <code>AffestAttestationVerifier</code>.</li>
        <li>The verifier calls <code>INativeQueryVerifier.verifyAndEmit</code> on the BlockProver precompile at <code>0x0000000000000000000000000000000000000FD2</code>, decodes the returned transaction, and requires receipt status 1.</li>
        <li>It then checks emitter, event signature, log index, user, asset, minimum amount, and signal type.</li>
      </ol>
      <p>
        Only after those checks can <code>AffestStrategyManager</code> record an execution against vault limits.
      </p>

      <h2>Replay</h2>
      <p>
        The verifier derives a query ID from <code>(chainKey, blockHeight, txIndex)</code> and a processed-event key from <code>(queryId, receiptLogIndex)</code>. A second submission of the same source receipt log reverts with <code>EventAlreadyProcessed</code>.
      </p>

      <h2>What you will see</h2>
      <p>
        Rebalance now on the strategy page does not discretionary-swap. It tells you to wait for a verified proof. Pause and resume are on-chain and do not need a proof. Proof status on the strategy page tracks the source observation, not a fake fill.
      </p>

      <DocsCallout title="Inspect without submitting">
        <p>
          After building the worker you can inspect a source hash. This command never signs.
        </p>
        <pre>{`$env:SOURCE_TRANSACTION_HASH="0x..."
$env:ATTESTCOIN_PROOF_API_URL="https://..."
pnpm --filter @affest/worker build
pnpm --filter @affest/worker proof:inspect`}</pre>
      </DocsCallout>

      <p>
        Deployed emitter and verifier addresses are on <Link href="/docs/chains">Chains and contracts</Link>.
      </p>

      <DocsCallout title="New to the protocol?">
        <p>
          Start with the <Link href="/docs/attestcoin">Attestcoin integration summary</Link> for the plain-language version of this flow.
        </p>
      </DocsCallout>

      <DocsCards>
        <DocsCard href="/docs/how-it-works" title="How it works">
          Why the dashboard is not allowed to turn a log into a vault action.
        </DocsCard>
        <DocsCard href="/docs/mcp" title="MCP agents">
          Agents can explain the gate. They cannot skip it.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
