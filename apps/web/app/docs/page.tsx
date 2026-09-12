import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsHomePage() {
  return (
    <DocsArticle
      title="What Affest is"
      lede="A testnet control room for verified cross-chain automation. A Sepolia signal does not move funds because a dashboard or an agent said it happened. Creditcoin has to verify an Attestcoin proof first."
    >
      <p>
        Affest lets you hold TCTC on Creditcoin CC3 Testnet and ETH on Ethereum Sepolia, write a mix as an on-chain strategy, and wait for a verified <code>PortfolioSignal</code> before anything rebalances. The dashboard is the signer. MCP agents can read and draft. They cannot hold your key.
      </p>
      <p>
        You deposit real testnet TCTC and Sepolia ETH. There is no DEMO_STABLE or DEMO_RISK in the wallet flow. USD labels multiply those balances by main-market CTC and ETH spots from CoinGecko. The contracts do not read those spots.
      </p>

      <h2>Terminology</h2>
      <dl>
        <dt>Vault</dt>
        <dd>
          Your CC3 ERC-20 custody from <code>AffestVaultFactory</code>. Native TCTC is not a vault asset until it is wrapped to WTCTC and deposited.
        </dd>
        <dt>Strategy</dt>
        <dd>
          A CC3 policy on <code>AffestStrategyManager</code>. It stores the vault, TCTC and ETH weights, trigger asset, limits, cooldown, and pause state.
        </dd>
        <dt>PortfolioSignal</dt>
        <dd>
          A Sepolia event. Affest treats it as an observation until Creditcoin verifies an Attestcoin proof of that receipt.
        </dd>
        <dt>Rebalance</dt>
        <dd>
          A vault action toward the strategy mix. The manager records it only after the verifier accepts a proof. The dashboard Rebalance now button does not discretionary-swap.
        </dd>
        <dt>MCP credential</dt>
        <dd>
          A bearer token bound to your wallet. The server hashes it with HMAC-SHA256 after the one-time reveal. Scopes are read, plan, proof, and action. Action tools still do not sign.
        </dd>
      </dl>

      <h2>Lifecycle</h2>
      <p>Work moves in this order. Later steps do not skip the proof gate.</p>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Where</th>
            <th>What happens</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Connect</td>
            <td>Dashboard</td>
            <td>Injected wallet on CC3 (102031) and Sepolia (11155111).</td>
          </tr>
          <tr>
            <td>Deposit TCTC</td>
            <td>CC3</td>
            <td>Wrap native TCTC to WTCTC, then <code>vault.deposit</code>.</td>
          </tr>
          <tr>
            <td>Deposit ETH</td>
            <td>Sepolia</td>
            <td>Wrap to WETH at <code>0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9</code>. ETH stays on Ethereum.</td>
          </tr>
          <tr>
            <td>Compose</td>
            <td>Strategies</td>
            <td>Weights, If/Else, optional filter, optional USD amount.</td>
          </tr>
          <tr>
            <td>Create</td>
            <td>CC3</td>
            <td>You sign <code>createStrategy</code>. The canvas is also saved as a local draft.</td>
          </tr>
          <tr>
            <td>Signal</td>
            <td>Sepolia</td>
            <td><code>PortfolioSignalEmitter</code> logs an observation.</td>
          </tr>
          <tr>
            <td>Prove</td>
            <td>Attestcoin, then CC3</td>
            <td>The worker builds a proof. <code>AffestAttestationVerifier</code> checks it on Creditcoin.</td>
          </tr>
          <tr>
            <td>Execute</td>
            <td>CC3 vault</td>
            <td>The manager may record an action against the policy limits.</td>
          </tr>
        </tbody>
      </table>

      <DocsCallout title="This is testnet">
        <p>
          Creditcoin CC3 Testnet and Ethereum Sepolia only. The demo swap adapter is 1:1. There is no live keeper. Treat balances as disposable. Pause stays on-chain even if an MCP agent is connected.
        </p>
      </DocsCallout>

      <h2>What this is not</h2>
      <ul>
        <li>Not a DEX, a lender, or a mainnet product.</li>
        <li>Not a place an agent can sign a rebalance.</li>
        <li>Not a USD oracle. CoinGecko spots are display only.</li>
        <li>Not a path from native TCTC in the wallet into a strategy. Wrap, then vault.</li>
      </ul>

      <h2>Start here</h2>
      <DocsCards>
        <DocsCard href="/docs/start" title="Connect and deposit">
          Add CC3, wrap TCTC into the vault, wrap Sepolia ETH to WETH.
        </DocsCard>
        <DocsCard href="/docs/how-it-works" title="How it works">
          The Sepolia to Attestcoin to Creditcoin path, and who is trusted.
        </DocsCard>
        <DocsCard href="/docs/attestcoin" title="Attestcoin summary">
          A plain-language explanation of the proof gate and what it protects.
        </DocsCard>
        <DocsCard href="/docs/strategies" title="Strategies">
          Create a mix, set an amount, open View, edit the canvas later.
        </DocsCard>
        <DocsCard href="/docs/chatgpt" title="ChatGPT">
          Tunnel 8787, inject the bearer, add a Developer Mode connector.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
