import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsSecurityPage() {
  return (
    <DocsArticle
      title="Security"
      lede="Affest never asks for a private key. The dashboard talks to an injected wallet. MCP credentials are hashed after the one-time reveal."
    >
      <h2>Who is trusted</h2>
      <ul>
        <li>Your wallet signs CC3 and Sepolia transactions.</li>
        <li>Creditcoin verifies Attestcoin proofs before the strategy manager may record an execution.</li>
        <li>The worker and the dashboard are not permissions. They can observe and they can submit a proof. They cannot skip the verifier.</li>
        <li>MCP is bound to a hashed credential. Action tools still return unsigned hints.</li>
      </ul>

      <h2>On-chain limits</h2>
      <ul>
        <li>No arbitrary calldata from the strategy manager into the vault.</li>
        <li>Allowlisted adapter and assets only.</li>
        <li>Per-action, weekly, and slippage caps on the policy.</li>
        <li>Cooldown and expiry on the policy.</li>
        <li>Emergency pause is owner-signed on CC3. An agent being connected does not keep a paused strategy live.</li>
      </ul>

      <h2>MCP credentials</h2>
      <p>
        Generate on /agents while connected. The raw token is returned once. Affest keeps HMAC-SHA256 of that token. Revoke invalidates the hash. A revoked bearer gets rejected on the next call. Rate limit is 60 requests per minute per credential.
      </p>
      <p>
        Scopes are <code>read</code>, <code>plan</code>, <code>proof</code>, and <code>action</code>. Read tools query live CC3 and Sepolia for the bound wallet. Plan tools draft. They mark the draft not executable.
      </p>

      <DocsCallout title="Keys stay off NEXT_PUBLIC">
        <p>
          Relayer or deployer keys must never use a <code>NEXT_PUBLIC_</code> variable. The chain-config parser throws if that name appears. Browser bundles would otherwise ship the key.
        </p>
      </DocsCallout>

      <h2>What is still a demo</h2>
      <ul>
        <li>The swap adapter is 1:1. It is not a production DEX.</li>
        <li>The executor is not a live keeper you should assume is running.</li>
        <li>Testnet TCTC and Sepolia ETH are not mainnet CTC or ETH.</li>
        <li>USD labels are CoinGecko spots times testnet balances.</li>
        <li>Strategy display names and amounts live in <code>localStorage</code>. Clearing site data drops drafts. On-chain policy remains.</li>
      </ul>
      <p>
        Known testnet edges are listed on <Link href="/docs/testnet">Testnet notes</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/mcp" title="MCP agents">
          How to issue, copy, and revoke a token.
        </DocsCard>
        <DocsCard href="/docs/proofs" title="Proofs">
          The checks that have to pass before funds move.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
