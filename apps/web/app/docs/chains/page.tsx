import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsChainsPage() {
  return (
    <DocsArticle
      title="Chains and contracts"
      lede="Affest talks to Creditcoin CC3 Testnet for vault and strategy state, and to Ethereum Sepolia for the source signal and WETH."
    >
      <h2>Networks</h2>
      <table>
        <thead>
          <tr>
            <th>Network</th>
            <th>Chain ID</th>
            <th>Hex</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Creditcoin CC3 Testnet</td>
            <td>102031</td>
            <td><code>0x18e8f</code></td>
            <td>Vault, WTCTC, strategy manager, verifier, executor.</td>
          </tr>
          <tr>
            <td>Ethereum Sepolia</td>
            <td>11155111</td>
            <td><code>0xaa36a7</code></td>
            <td>PortfolioSignal emitter and canonical WETH.</td>
          </tr>
        </tbody>
      </table>
      <p>
        CC3 RPC is <code>https://rpc.cc3-testnet.creditcoin.network</code>. Explorer is <a href="https://creditcoin-testnet.blockscout.com">creditcoin-testnet.blockscout.com</a>. Sepolia explorer is <a href="https://sepolia.etherscan.io">sepolia.etherscan.io</a>. Native symbol on CC3 is TCTC.
      </p>

      <h2>Sepolia</h2>
      <table>
        <thead>
          <tr>
            <th>Contract</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Canonical WETH</td>
            <td><code>0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9</code></td>
          </tr>
          <tr>
            <td>PortfolioSignalEmitter</td>
            <td><code>0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6</code></td>
          </tr>
        </tbody>
      </table>

      <h2>Creditcoin CC3</h2>
      <table>
        <thead>
          <tr>
            <th>Contract</th>
            <th>Address</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AffestVaultFactory</td>
            <td><code>0x6A83bC86a1cF17b7F5a22d96e6aF376402491749</code></td>
          </tr>
          <tr>
            <td>AffestStrategyManager</td>
            <td><code>0xf016A45345857aeE7e93C987B4429840B779020B</code></td>
          </tr>
          <tr>
            <td>AffestAttestationVerifier</td>
            <td><code>0xD5ed47C1b75D41DFE2de73620C1f496d89861D1D</code></td>
          </tr>
          <tr>
            <td>AffestExecutor</td>
            <td><code>0x2544619c10F049DEE88b121B7A0c6f6d144cA883</code></td>
          </tr>
          <tr>
            <td>DemoSwapAdapter</td>
            <td><code>0xd010E8bdbd492124aF10D2ac3f025beaC2E9D44C</code></td>
          </tr>
        </tbody>
      </table>
      <p>
        Your vault address is not in this table. The factory returns it from <code>vaultOf(owner)</code> after the first TCTC deposit creates one. WTCTC is deployed per browser the first time you wrap, then reused from local storage.
      </p>

      <DocsCallout title="Legacy demo tokens">
        <p>
          Older slices deployed DEMO_STABLE at <code>0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6</code> on CC3 and DEMO_RISK at <code>0x3cC438F47c330AB747cf5404c573156221beD2fD</code>. The dashboard deposit path does not use them. Deposit TCTC and Deposit ETH.
        </p>
      </DocsCallout>

      <h2>Precompile</h2>
      <p>
        Creditcoin BlockProver is <code>0x0000000000000000000000000000000000000FD2</code>. Attestcoin chain key for Sepolia is <code>1</code>. See <Link href="/docs/proofs">Proofs</Link> for the verify call.
      </p>

      <DocsCards>
        <DocsCard href="/docs/start" title="Connect and deposit">
          Add 102031, wrap TCTC, wrap Sepolia ETH.
        </DocsCard>
        <DocsCard href="/docs/testnet" title="Testnet notes">
          Faucets, USD spots, and the hex that is not CC3.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
