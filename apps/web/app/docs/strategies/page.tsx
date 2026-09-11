import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsStrategiesPage() {
  return (
    <DocsArticle
      title="Strategies"
      lede="A strategy is a CC3 policy. Overview lists yours. View opens the live page. The canvas is a draft you can edit after the create transaction."
    >
      <h2>What gets stored on-chain</h2>
      <p>
        <code>createStrategy</code> writes a policy on <code>AffestStrategyManager</code>. The tuple includes the vault, stable and risk assets, trigger asset, minimum trigger amount, signal type, TCTC and ETH weights in basis points, execution mode, per-action and weekly caps, slippage cap, expiry, and cooldown.
      </p>
      <p>
        Affest maps TCTC to the vault stable asset and ETH to the risk asset in the current testnet pair. Trigger asset must be a real ERC-20. The manager rejects <code>address(0)</code>.
      </p>

      <h2>Overview</h2>
      <p>
        My strategies is a table. Current value and 24h are per row, not a copy of the whole wallet. Each row uses that strategy&apos;s TCTC/ETH weights. If you set an amount, the row tracks that amount against the CoinGecko spots captured at set time.
      </p>
      <table>
        <thead>
          <tr>
            <th>Control</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>View</td>
            <td>Opens the live strategy page. Pause, resume, and proof status live there.</td>
          </tr>
          <tr>
            <td>⋯ Edit canvas</td>
            <td>Reopens the saved draft in the builder.</td>
          </tr>
          <tr>
            <td>⋯ Rename</td>
            <td>Changes the local draft name. On-chain policy is unchanged.</td>
          </tr>
          <tr>
            <td>⋯ Set amount</td>
            <td>Sets how much USD this row tracks, with spot baselines.</td>
          </tr>
        </tbody>
      </table>

      <h2>Amount</h2>
      <p>
        Two strategies should not both claim the whole bag. On create, fill <b>Amount this strategy tracks</b>, or use ⋯ → Set amount later. Current value then follows <code>allocatedUsd</code> times the mix return from those baselines. Without an amount, the row still uses the strategy weights against live holdings, which is an implied mix, not a second copy of every dollar.
      </p>

      <h2>Create</h2>
      <ol>
        <li>Open Strategies and compose blocks. Weight sits at the top. Add Asset, If/Else, or Filter with +.</li>
        <li>Both assets have to appear across the canvas. An If/Else needs a complete condition and TCTC or ETH in Then and Else.</li>
        <li>Optionally set the USD amount.</li>
        <li>Click Create strategy and sign on CC3.</li>
      </ol>
      <p>
        After the tx, View sits next to Create strategy. The canvas is written to <code>localStorage</code> under <code>affest.strategy.drafts</code>, keyed by the new strategy id. Edit canvas later loads that draft. Names come from the draft, not from the manager.
      </p>

      <DocsCallout title="Create is not a rebalance">
        <p>
          Signing <code>createStrategy</code> stores the policy. Funds do not move toward the mix until a verified Sepolia <code>PortfolioSignal</code> lands. See <Link href="/docs/proofs">Proofs</Link>.
        </p>
      </DocsCallout>

      <h2>Pause and resume</h2>
      <p>
        Pause and resume are owner-signed CC3 calls. They do not need a proof. An MCP agent can tell you to pause. It cannot submit the tx. Emergency pause is also independent of any credential on Agents.
      </p>

      <h2>Templates</h2>
      <p>
        Overview also shows starter mixes you can drop onto the canvas. They are drafts, not live strategies, until you create. They still have to pass the same completeness rules.
      </p>

      <DocsCards>
        <DocsCard href="/docs/builder" title="If/Else and filters">
          Condition chips, Then/Else slots, and how Filter ranks TCTC vs ETH.
        </DocsCard>
        <DocsCard href="/docs/start" title="Connect and deposit">
          Vault TCTC and Sepolia WETH have to exist before a mix means anything.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
