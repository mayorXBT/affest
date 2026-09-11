import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsMcpPage() {
  return (
    <DocsArticle
      title="MCP agents"
      lede="The MCP server is read-and-plan. It never holds your browser key. Generate a credential on Agents while the wallet is connected. The token is shown once."
    >
      <h2>What an agent can do</h2>
      <p>
        Run <code>pnpm --filter @affest/mcp start</code>. The process listens on <code>http://127.0.0.1:8787/mcp</code>. Health is <code>/health</code>. The SDK is Streamable HTTP 1.30.0. Initialize must send <code>Accept: application/json, text/event-stream</code> or the server returns -32000.
      </p>
      <p>
        Open Affest /agents, connect the wallet, and generate a credential. Copy it from the input. Affest stores an HMAC-SHA256 hash, not the raw token. Revoke on the same page. The token is bound to that address.
      </p>

      <DocsCallout title="MCP never signs">
        <p>
          Pause remains an on-chain call from the dashboard. <code>draft_strategy</code> returns a mix marked <code>executable: false</code>. You still sign <code>createStrategy</code>. Relayer keys must never use a <code>NEXT_PUBLIC_</code> variable.
        </p>
      </DocsCallout>

      <h2>Claude Code or Cursor, HTTP</h2>
      <pre>{`{
  "mcpServers": {
    "affest": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": { "Authorization": "Bearer aff_YOUR_TOKEN" }
    }
  }
}`}</pre>

      <h2>Claude Desktop, stdio</h2>
      <p>
        Build first, then point Desktop at <code>apps/mcp/dist/stdio.js</code> with <code>AFFEST_WALLET</code> set to your address.
      </p>
      <pre>{`{
  "mcpServers": {
    "affest": {
      "command": "node",
      "args": ["apps/mcp/dist/stdio.js"],
      "env": { "AFFEST_WALLET": "0xYourAddress" }
    }
  }
}`}</pre>
      <h2>ChatGPT</h2>
      <p>
        ChatGPT cannot use <code>http://127.0.0.1:8787/mcp</code>. It only talks to a public HTTPS URL, and it usually cannot send <code>Authorization</code>. Tunnel 8787 with ngrok, inject the bearer on the tunnel, then add the <code>https://…/mcp</code> URL as a Developer Mode connector. Full click path: <Link href="/docs/chatgpt">ChatGPT</Link>.
      </p>

      <h2>Tools</h2>
      <p>
        Rate limit is 60 calls per 60 seconds per credential. Missing scope throws <code>missing scope: …</code>.
      </p>
      <table>
        <thead>
          <tr>
            <th>Tool</th>
            <th>Scope</th>
            <th>What it does</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><code>get_affest_account</code></td>
            <td>read</td>
            <td>Wallet, CC3 TCTC, vault, Sepolia ETH.</td>
          </tr>
          <tr>
            <td><code>get_portfolios</code></td>
            <td>read</td>
            <td>Same holdings as a one-item list.</td>
          </tr>
          <tr>
            <td><code>get_portfolio</code></td>
            <td>read</td>
            <td>Live vault and wallet holdings.</td>
          </tr>
          <tr>
            <td><code>get_active_strategies</code></td>
            <td>read</td>
            <td>Live CC3 strategies for this wallet.</td>
          </tr>
          <tr>
            <td><code>get_strategy</code></td>
            <td>read</td>
            <td>One strategy by id.</td>
          </tr>
          <tr>
            <td><code>draft_strategy</code></td>
            <td>plan</td>
            <td>Natural-language TCTC/ETH mix. Not executable.</td>
          </tr>
          <tr>
            <td><code>explain_rebalance</code></td>
            <td>plan</td>
            <td>When Affest is allowed to rebalance.</td>
          </tr>
          <tr>
            <td><code>pause_strategy</code></td>
            <td>action</td>
            <td>Describes how to pause. Does not sign.</td>
          </tr>
          <tr>
            <td><code>revoke_agent_access</code></td>
            <td>action</td>
            <td>Revokes this credential immediately.</td>
          </tr>
        </tbody>
      </table>

      <h2>Connect from the app</h2>
      <p>
        Agents also has Claude and GPT connect copy. Those snippets use the live local URL and the token you just generated. Do not paste a token into a public gist.
      </p>
      <p>
        Security around hashing and revoke is on <Link href="/docs/security">Security</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/chatgpt" title="ChatGPT">
          ngrok header inject, Developer Mode, and prompts that actually call tools.
        </DocsCard>
        <DocsCard href="/docs/errors" title="Errors">
          Initialize without Accept, 401 bearer, and a revoked token.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
