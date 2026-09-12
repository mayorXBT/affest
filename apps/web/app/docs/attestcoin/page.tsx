import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsAttestcoinPage() {
  return (
    <DocsArticle
      title="Attestcoin integration summary"
      lede="Affest uses Attestcoin to prove an Ethereum event before a Creditcoin strategy can act on it."
    >
      <h2>The short version</h2>
      <p>
        A user creates a <code>PortfolioSignal</code> event on Ethereum Sepolia. Affest treats that event as an observation, not as permission to move assets. The worker waits for the source block to be attested, builds the official proof, and sends it to Creditcoin.
      </p>
      <pre>{`Ethereum Sepolia event
  -> Attestcoin attestation and proof
  -> Creditcoin proof verification
  -> Affest strategy limits
  -> approved or automatic portfolio action`}</pre>

      <h2>What the proof gate checks</h2>
      <p>
        Creditcoin verifies the Attestcoin proof through the BlockProver path. Affest then checks the source receipt and event data before the strategy manager records any action.
      </p>
      <ul>
        <li>The source chain is Ethereum Sepolia with Attestcoin chain key <code>1</code>.</li>
        <li>The source transaction succeeded.</li>
        <li>The event came from the configured <code>PortfolioSignalEmitter</code>.</li>
        <li>The event signature, user, asset, amount, and signal type match the strategy.</li>
        <li>The source event has not already been used.</li>
      </ul>

      <h2>Why this matters</h2>
      <p>
        The worker and an AI agent can find a signal, explain it, and prepare a rebalance. Neither one can turn an unverified message into permission to move funds. Creditcoin enforces the user&apos;s asset allowlist, amount limits, allocation rules, expiry, pause state, and replay protection.
      </p>

      <h2>What is real and what is limited</h2>
      <p>
        The proof builder uses the official <code>@gluwa/usc-sdk</code>, and verification runs through the official Creditcoin BlockProver precompile. The CC3 exchange adapter is a labelled 1:1 demo adapter because a supported testnet DEX route and liquidity were not confirmed. Attestcoin verification is not mocked.
      </p>

      <DocsCallout title="Testnet scope">
        <p>
          Affest runs on Creditcoin CC3 Testnet and Ethereum Sepolia. Use testnet assets only. Read the <Link href="/docs/testnet">testnet notes</Link> before trying the demo.
        </p>
      </DocsCallout>

      <p>
        For event fields, proof-builder details, and replay keys, read <Link href="/docs/proofs">Proofs</Link>. For addresses and network settings, read <Link href="/docs/chains">Chains and contracts</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/proofs" title="Read the proof reference">
          See the exact event shape and every verifier check.
        </DocsCard>
        <DocsCard href="/docs/how-it-works" title="See the full architecture">
          Follow the worker, verifier, executor, and vault path.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
