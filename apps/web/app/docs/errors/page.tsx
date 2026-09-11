import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsErrorsPage() {
  return (
    <DocsArticle
      title="Errors"
      lede="Failures Affest already hit on this testnet, and what to do. Fix 400-class mistakes before you retry a write."
    >
      <h2>Wallet and chains</h2>
      <table>
        <thead>
          <tr>
            <th>What you see</th>
            <th>Cause</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Add-chain lands on the wrong Creditcoin</td>
            <td>Hex <code>0x18e6f</code> is 101999, not 102031.</td>
            <td>Add CC3 with <code>0x18e8f</code>. Details in <Link href="/docs/start">Connect and deposit</Link>.</td>
          </tr>
          <tr>
            <td>Connect succeeds, vault reads fail</td>
            <td>Wallet is on Sepolia or another chain.</td>
            <td>Switch to CC3 from the header chip for vault work.</td>
          </tr>
        </tbody>
      </table>

      <h2>Deposits</h2>
      <table>
        <thead>
          <tr>
            <th>What you see</th>
            <th>Cause</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Wrap succeeded, vault row empty</td>
            <td>WTCTC is in the wallet. <code>vault.deposit</code> did not send.</td>
            <td>Use Move into vault. Do not wrap a second time.</td>
          </tr>
          <tr>
            <td>ETH Deposit says not enough</td>
            <td>Dead Sepolia RPC, or the field defaulted past live balance.</td>
            <td>Wait for live balance. Click Max. Confirm you are on Sepolia.</td>
          </tr>
          <tr>
            <td>createStrategy reverts on the vault</td>
            <td>Vault is <code>address(0)</code>, or an asset is zero.</td>
            <td>Finish TCTC vault deposit first. The manager rejects zero addresses.</td>
          </tr>
        </tbody>
      </table>

      <h2>Strategies</h2>
      <table>
        <thead>
          <tr>
            <th>What you see</th>
            <th>Cause</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Create stays disabled</td>
            <td>Incomplete If/Else or Filter, or only one asset on the canvas.</td>
            <td>Fill the cyan chip, put assets in Then and Else, include TCTC and ETH. See <Link href="/docs/builder">If/Else and filters</Link>.</td>
          </tr>
          <tr>
            <td>Two rows share Current value and 24h</td>
            <td>Both were using the whole wallet and ETH 24h.</td>
            <td>Set amount per strategy from ⋯. Values then follow that mix.</td>
          </tr>
          <tr>
            <td>Rebalance now does nothing on-chain</td>
            <td>Expected. No verified proof yet.</td>
            <td>Wait for a Sepolia <code>PortfolioSignal</code> that Creditcoin accepts. <Link href="/docs/proofs">Proofs</Link>.</td>
          </tr>
        </tbody>
      </table>

      <h2>MCP</h2>
      <table>
        <thead>
          <tr>
            <th>What you see</th>
            <th>Cause</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Initialize returns -32000</td>
            <td>Missing <code>Accept: application/json, text/event-stream</code>.</td>
            <td>Send that header. Most MCP clients do. Raw curl often does not.</td>
          </tr>
          <tr>
            <td>EADDRINUSE on 8787</td>
            <td>An MCP process is already bound.</td>
            <td>Reuse it. Do not start a second listener.</td>
          </tr>
          <tr>
            <td><code>missing scope: plan</code></td>
            <td>Credential was issued without that scope.</td>
            <td>Generate a new token on Agents with the scopes you need.</td>
          </tr>
          <tr>
            <td>rate limit exceeded</td>
            <td>More than 60 calls in 60 seconds on one credential.</td>
            <td>Wait for the window. Do not spray retries.</td>
          </tr>
          <tr>
            <td>ChatGPT connection failed</td>
            <td>URL is localhost or missing <code>/mcp</code>, or the tunnel is down.</td>
            <td>Use the ngrok <code>https://…/mcp</code> URL. Steps in <Link href="/docs/chatgpt">ChatGPT</Link>.</td>
          </tr>
          <tr>
            <td>ChatGPT <code>401</code> bearer required</td>
            <td>ChatGPT did not send <code>Authorization</code>, and the tunnel did not inject it.</td>
            <td>Restart ngrok with <code>--request-header-add &quot;Authorization: Bearer aff_…&quot;</code>. Pick No authentication in the connector.</td>
          </tr>
          <tr>
            <td>ChatGPT connected, never calls tools</td>
            <td>Developer Mode connectors are off until you pick them in that chat.</td>
            <td>New chat, +, More, Developer Mode, enable Affest.</td>
          </tr>
        </tbody>
      </table>

      <DocsCallout title="Do not retry a successful wrap">
        <p>
          If the wrap hash is in Activity and WTCTC is in the wallet, the next click is Move into vault. Wrapping again spends more TCTC and still leaves the vault empty.
        </p>
      </DocsCallout>

      <DocsCards>
        <DocsCard href="/docs/testnet" title="Testnet notes">
          Chain hex, RPC, and other sharp edges in one list.
        </DocsCard>
        <DocsCard href="/docs/mcp" title="MCP agents">
          Headers, tools, and how to revoke a bad token.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
