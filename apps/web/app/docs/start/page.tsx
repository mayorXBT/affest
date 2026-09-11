import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsStartPage() {
  return (
    <DocsArticle
      title="Connect and deposit"
      lede="Open the dashboard, connect MetaMask, and move testnet TCTC and Sepolia ETH into the holdings Affest can see."
    >
      <h2>Before you start</h2>
      <ul>
        <li>An injected wallet. Affest uses wagmi against MetaMask. It does not ask for a private key.</li>
        <li>TCTC on Creditcoin CC3 Testnet. Chain ID <code>102031</code>, hex <code>0x18e8f</code>.</li>
        <li>ETH on Ethereum Sepolia, chain ID <code>11155111</code>.</li>
        <li>Enough gas on both chains. Wrap and vault are separate CC3 transactions. ETH wrap is a Sepolia transaction.</li>
      </ul>

      <DocsCallout title="Add the right CC3 hex">
        <p>
          If the wallet prompts to add Creditcoin CC3, confirm chain ID 102031. The hex is <code>0x18e8f</code>. A nearby wrong value, <code>0x18e6f</code>, is 101999 and is not this network.
        </p>
      </DocsCallout>

      <h2>1. Connect</h2>
      <p>
        Open the app and click Connect. The wallet should sit on CC3 for vault work and on Sepolia for ETH deposit. The header chip shows which chain you are on. Switch from there if the prompt asks.
      </p>
      <p>
        CC3 RPC is <code>https://rpc.cc3-testnet.creditcoin.network</code>. Explorer is <a href="https://creditcoin-testnet.blockscout.com">creditcoin-testnet.blockscout.com</a>. Sepolia explorer is <a href="https://sepolia.etherscan.io">sepolia.etherscan.io</a>.
      </p>

      <h2>2. Deposit TCTC</h2>
      <p>
        The vault is ERC-20 only. Native TCTC in the wallet is not in a strategy. Deposit TCTC does two jobs, and both need a signature.
      </p>
      <ol>
        <li>Wrap native TCTC to WTCTC. First use on a browser may also deploy the wrapper.</li>
        <li>Call <code>vault.deposit</code> with that WTCTC. First use also creates your vault from <code>AffestVaultFactory</code> at <code>0x6A83bC86a1cF17b7F5a22d96e6aF376402491749</code>.</li>
      </ol>
      <p>
        If wrap succeeded and the vault row is still empty, WTCTC is sitting in the wallet. Use <b>Move into vault</b>. Do not wrap again hoping the vault fills itself.
      </p>
      <p>
        You should see a WTCTC wallet row until the second tx lands, then a vault TCTC row. Activity lists both hashes.
      </p>

      <h2>3. Deposit ETH</h2>
      <p>
        Pick ETH · Ethereum Sepolia. Deposit ETH wraps native Sepolia ETH to WETH at <code>0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9</code>. Native ETH has no ERC-20 address, so Sepolia stores the deposit as WETH.
      </p>
      <p>
        ETH stays on Ethereum. It cannot move into the Creditcoin vault. The strategy still names ETH as the other leg of the mix. Execution on CC3 uses the allowlisted adapter against vault assets. The Sepolia WETH balance is the ETH holding the dashboard shows.
      </p>
      <p>
        Use <b>Max</b> if the amount field is empty. The app reads live <code>getBalance</code> on Sepolia. A dead RPC makes ETH look like zero and the button look like you do not have enough.
      </p>

      <h2>USD numbers</h2>
      <p>
        Holdings multiply testnet amounts by CoinGecko spots for <code>creditcoin-2</code> and <code>ethereum</code>. Sparklines use the same series. That is a display. The verifier and the strategy manager never take a CoinGecko price as a proof.
      </p>

      <h2>What you should see</h2>
      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Where it lives</th>
            <th>Ready for a strategy</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Native TCTC</td>
            <td>CC3 wallet</td>
            <td>No. Wrap it.</td>
          </tr>
          <tr>
            <td>WTCTC</td>
            <td>CC3 wallet</td>
            <td>No. Move into vault.</td>
          </tr>
          <tr>
            <td>Vault TCTC</td>
            <td>Your Affest vault on CC3</td>
            <td>Yes.</td>
          </tr>
          <tr>
            <td>Sepolia ETH</td>
            <td>Wallet</td>
            <td>No. Deposit ETH wraps it.</td>
          </tr>
          <tr>
            <td>WETH</td>
            <td>Sepolia, canonical WETH</td>
            <td>Yes, as the ETH leg the dashboard tracks.</td>
          </tr>
        </tbody>
      </table>

      <p>
        Next, <Link href="/docs/strategies">create a strategy</Link>. Builder details live under <Link href="/docs/builder">If/Else and filters</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/how-it-works" title="How it works">
          Why a deposit is not a rebalance, and what still has to be proven.
        </DocsCard>
        <DocsCard href="/docs/errors" title="Errors">
          Wrap-without-vault, dead Sepolia RPC, and the wrong CC3 chain hex.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
