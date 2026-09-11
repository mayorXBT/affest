import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsTestnetPage() {
  return (
    <DocsArticle
      title="Testnet notes"
      lede="Creditcoin CC3 Testnet chain ID is 102031 (0x18e8f). Sepolia is the source of PortfolioSignal. Treat balances as disposable."
    >
      <h2>What is live</h2>
      <ul>
        <li>Wallet connect through injected MetaMask.</li>
        <li>Wrap TCTC to WTCTC and vault.deposit on CC3.</li>
        <li>Wrap Sepolia ETH to canonical WETH.</li>
        <li>createStrategy, pause, and resume on the strategy manager.</li>
        <li>MCP Streamable HTTP on 8787 with hashed credentials.</li>
      </ul>
      <p>
        USD labels use CoinGecko main-market spots for <code>creditcoin-2</code> and <code>ethereum</code> times those testnet balances. Sparklines use the same series. That is not an oracle the contracts trust.
      </p>

      <DocsCallout title="Hackathon testnet">
        <p>
          This is not a mainnet product. The demo swap adapter is 1:1. There is no live keeper you should assume will catch a signal while you sleep. Pause on-chain if you want the policy quiet.
        </p>
      </DocsCallout>

      <h2>Known sharp edges</h2>
      <ul>
        <li>
          Add CC3 with hex <code>0x18e8f</code> (102031), not <code>0x18e6f</code> (101999).
        </li>
        <li>
          Wrap TCTC, then <code>vault.deposit</code>. WTCTC in the wallet is not vaulted yet. Use Move into vault.
        </li>
        <li>
          Sepolia RPC fallbacks matter. A 400 from a dead RPC makes ETH look like zero and Deposit ETH look underfunded. The app now reads live <code>getBalance</code> and Max uses <code>.value</code>.
        </li>
        <li>
          MCP HTTP initialize needs <code>Accept: application/json, text/event-stream</code>.
        </li>
        <li>
          Strategy Current value is per mix. Set an amount if two rows should not look like the whole wallet.
        </li>
        <li>
          Draft names live in the browser. Another device will show the on-chain id until you rename there too.
        </li>
      </ul>

      <h2>Explorers</h2>
      <ul>
        <li>
          CC3: <a href="https://creditcoin-testnet.blockscout.com">creditcoin-testnet.blockscout.com</a>
        </li>
        <li>
          Sepolia: <a href="https://sepolia.etherscan.io">sepolia.etherscan.io</a>
        </li>
      </ul>
      <p>
        Addresses are listed on <Link href="/docs/chains">Chains and contracts</Link>. Failures that show up in the UI are on <Link href="/docs/errors">Errors</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/start" title="Connect and deposit">
          The first path that has to work on this testnet.
        </DocsCard>
        <DocsCard href="/docs/security" title="Security">
          What is enforced on-chain versus what is still a demo.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
