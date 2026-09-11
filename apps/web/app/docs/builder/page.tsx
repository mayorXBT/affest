import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsBuilderPage() {
  return (
    <DocsArticle
      title="If/Else and filters"
      lede="The builder is a canvas. Weight sits at the top. Everything else is a block you add with +. Create still signs a CC3 policy. Simulation is not execution."
    >
      <h2>Blocks</h2>
      <table>
        <thead>
          <tr>
            <th>Block</th>
            <th>Job</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Asset</td>
            <td>Places TCTC or ETH on the canvas. Needed in Then and Else, and at the root when there is no branch.</td>
          </tr>
          <tr>
            <td>Weight</td>
            <td>The TCTC/ETH split for the active mix. Always present.</td>
          </tr>
          <tr>
            <td>If/Else</td>
            <td>A condition over two market functions, plus Then and Else mixes.</td>
          </tr>
          <tr>
            <td>Filter</td>
            <td>Ranks TCTC vs ETH by a metric and keeps Top or Bottom N.</td>
          </tr>
        </tbody>
      </table>

      <h2>If/Else</h2>
      <p>
        The cyan chip is the rule. Empty, it says Set Condition. Filled, it reads as a sentence, for example <code>If Current Price of ETH is greater than Current Price of TCTC</code>.
      </p>
      <p>
        Click the chip to edit. The editor is a two-column condition. Each side is a function of an asset, or a fixed value. Comparators are greater than, less than, and equal. On desktop the popover opens to the right of the chip so it does not cover +.
      </p>
      <p>
        Then and Else start as Select block. They are empty on purpose. Add TCTC or ETH into those slots. The simulation holds the Then mix when the condition is true, and the Else mix when it is false.
      </p>
      <p>
        Create refuses an incomplete If/Else. You need a full condition sentence and at least one asset in each branch. Both TCTC and ETH still have to appear somewhere on the canvas, because the on-chain policy is a two-asset pair.
      </p>

      <h2>Filter</h2>
      <p>
        Filter ranks the two assets, then keeps Top or Bottom N. The chip reads like <code>Sort by Percent Gain, Select Top 1</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Current Price</td>
            <td>CoinGecko spot for <code>creditcoin-2</code> or <code>ethereum</code>.</td>
          </tr>
          <tr>
            <td>Market Cap</td>
            <td>Same API, market cap field.</td>
          </tr>
          <tr>
            <td>Volume</td>
            <td>Same API, 24h volume.</td>
          </tr>
          <tr>
            <td>Percent Gain</td>
            <td>7-day move on the sparkline series.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Affest only has two assets. Top 1 values the winner at 100%. Top 2 keeps both. Bottom works the same way from the other end of the rank. Filter is a simulation input. It does not replace the proof gate.
      </p>

      <h2>What create checks</h2>
      <ul>
        <li>Weight is present.</li>
        <li>TCTC and ETH both appear, including across If/Else branches.</li>
        <li>Every If/Else has a complete condition and assets in Then and Else.</li>
        <li>Every Filter has a metric, a side, and a count.</li>
      </ul>

      <DocsCallout title="Simulation is display">
        <p>
          The canvas uses CoinGecko spots to preview which branch or filter winner is active. The strategy manager does not read those spots. A verified <Link href="/docs/proofs">PortfolioSignal proof</Link> is still required before CC3 execution.
        </p>
      </DocsCallout>

      <DocsCards>
        <DocsCard href="/docs/strategies" title="Strategies">
          Amount, View after create, and the ⋯ menu that reopens this canvas.
        </DocsCard>
        <DocsCard href="/docs/how-it-works" title="How it works">
          Where a composed mix sits in the Sepolia to Creditcoin path.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
