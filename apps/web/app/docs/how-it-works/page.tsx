import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsHowItWorksPage() {
  return (
    <DocsArticle
      title="How it works"
      lede="Sepolia emits an observation. Attestcoin proves the receipt. Creditcoin is the first place Affest is allowed to treat that observation as a signal."
    >
      <p>
        The dashboard and the MCP server are consumers. They do not grant permission to move vault assets. Ethereum logs and the worker database are also observations. The verifier is the first component that may turn a source receipt into a verified event key.
      </p>

      <h2>The path</h2>
      <pre>{`Ethereum Sepolia  PortfolioSignalEmitter
        logs + receipt
        v
AttestationWorker  Attestcoin proof API / @gluwa/usc-sdk
        persisted trigger + proof
        v
AffestExecutor  AffestAttestationVerifier  BlockProver precompile
        verified event key
        v
AffestStrategyManager  AffestVault  ISwapAdapter`}</pre>

      <p>
        Sepolia is Attestcoin chain key <code>1</code>. The Creditcoin BlockProver precompile is <code>0x0000000000000000000000000000000000000FD2</code>. The worker talks to Attestcoin with <code>@gluwa/usc-sdk@0.18.0</code>.
      </p>

      <h2>Trust boundaries</h2>
      <ul>
        <li>
          <code>AffestAttestationVerifier</code> checks receipt success, emitter, event signature, decoded user, asset, amount, signal type, source chain key, log index, and replay.
        </li>
        <li>
          <code>AffestStrategyManager</code> then enforces allocation and execution policy. Per-action, weekly, and slippage caps live on the strategy.
        </li>
        <li>
          <code>AffestExecutor</code> can only call the vault with an allowlisted adapter and assets. It cannot pass arbitrary calldata.
        </li>
        <li>
          The demo adapter is a fixed pair at 1:1. It is not a DEX and not a price oracle.
        </li>
      </ul>

      <h2>Why two chains</h2>
      <p>
        This testnet exists to prove a Sepolia observation on Creditcoin, not to run a single-chain vault. The signal is emitted where the observation happens, Ethereum Sepolia. The funds Affest can move on Creditcoin sit in a CC3 vault. Bridging a log by trusting the dashboard would skip Attestcoin. Affest does not do that.
      </p>
      <p>
        ETH you deposit stays on Sepolia as WETH. TCTC you deposit sits in the CC3 vault as WTCTC. The strategy names both legs. A verified proof is still required before the manager records an execution.
      </p>

      <h2>Restart safety</h2>
      <p>
        The worker stores coordination state with a unique <code>(source_chain, source_transaction_hash, log_index)</code> key. A restart must not replay a source event or drop a proof that is waiting for Creditcoin. The verifier also rejects a second submission of the same receipt log with <code>EventAlreadyProcessed</code>.
      </p>

      <DocsCallout title="Rebalance now is not a swap">
        <p>
          The strategy page can pause and resume on-chain without a proof. Those are owner-signed CC3 calls. Rebalance now tells you to wait for a verified <code>PortfolioSignal</code>. An MCP draft is also not an execution.
        </p>
      </DocsCallout>

      <p>
        The event shape and the verifier checks are on <Link href="/docs/proofs">Proofs</Link>. Chain IDs and addresses are on <Link href="/docs/chains">Chains and contracts</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/proofs" title="Proofs">
          What Creditcoin checks, how replay is keyed, and what the UI shows.
        </DocsCard>
        <DocsCard href="/docs/security" title="Security">
          Wallet rules, MCP hashing, pause, and what is still a demo.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
