import Link from 'next/link';
import { DocsArticle } from '@/components/docs/docs-article';
import { DocsCallout } from '@/components/docs/docs-callout';
import { DocsCard, DocsCards } from '@/components/docs/docs-cards';

export default function DocsChatGptPage() {
  return (
    <DocsArticle
      title="ChatGPT"
      lede="ChatGPT cannot hit localhost. It only talks to a public HTTPS MCP URL. The hosted Affest dashboard is https://affest.cefo.dev. Affest also requires Authorization: Bearer aff_… on every /mcp call, and ChatGPT usually cannot set that header. Inject the token at the MCP edge, then add the HTTPS URL as a custom connector."
    >
      <h2>What you need</h2>
      <ul>
        <li>ChatGPT Plus, Pro, Business, or Edu on chatgpt.com. Free does not get custom MCP. Mobile does not.</li>
        <li>Affest running locally, wallet connected.</li>
        <li>The MCP server on port 8787.</li>
        <li>ngrok, because it can attach the bearer header. Cloudflare Tunnel will not.</li>
      </ul>
      <p>
        Keep MCP, the tunnel, and the dashboard up the whole time you chat. Issue the token from <Link href="/docs/mcp">MCP agents</Link> first if you have not.
      </p>

      <h2>1. Start Affest MCP</h2>
      <p>From the repo root:</p>
      <pre>{`node "node_modules\\pnpm\\bin\\pnpm.cjs" --filter @affest/mcp start`}</pre>
      <p>
        You should see <code>Affest MCP listening on http://127.0.0.1:8787/mcp</code>. Leave that window open. Optional check: <code>http://127.0.0.1:8787/health</code> should return <code>ok: true</code>.
      </p>

      <h2>2. Issue a credential</h2>
      <ol>
        <li>Open Affest at <code>/agents</code>.</li>
        <li>Connect the same MetaMask wallet you deposited with.</li>
        <li>Click Generate MCP credential.</li>
        <li>Copy the token from the input. It starts with <code>aff_</code>. Affest shows it once.</li>
      </ol>
      <p>
        That token is bound to that wallet. ChatGPT will read that account&apos;s vault, TCTC, Sepolia ETH, and strategies. It still cannot sign.
      </p>

      <h2>3. Expose 8787 over HTTPS and attach the token</h2>
      <p>
        ChatGPT calls OpenAI&apos;s servers, not your laptop. <code>http://127.0.0.1:8787/mcp</code> will fail.
      </p>
      <p>In a second PowerShell window:</p>
      <pre>{`ngrok http 8787 --request-header-add "Authorization: Bearer PASTE_YOUR_aff_TOKEN"`}</pre>
      <p>
        Copy the HTTPS origin ngrok prints, then add <code>/mcp</code>. Example: <code>https://abc123.ngrok-free.app/mcp</code>.
      </p>
      <DocsCallout title="The tunnel carries the token">
        <p>
          ChatGPT will not send <code>Authorization</code> itself. In the connector form pick No authentication. A new ngrok URL appears every time you restart the free tunnel. Update the ChatGPT connector when that happens.
        </p>
      </DocsCallout>
      <p>
        Cloudflare Tunnel without a header inject gets <code>401 valid Affest bearer credential required</code>. Stick with ngrok for this.
      </p>

      <h2>4. Turn on Developer Mode</h2>
      <ol>
        <li>On chatgpt.com, open profile then Settings.</li>
        <li>Open Apps &amp; Connectors. The menu is sometimes Connectors or Plugins.</li>
        <li>Open Advanced and enable Developer Mode.</li>
      </ol>
      <p>
        If it is not there, try Settings → Security and login → Developer Mode. On Business or Enterprise, an admin has to allow it first.
      </p>

      <h2>5. Create the Affest connector</h2>
      <ol>
        <li>Stay on Connectors or Plugins and click Create, or the plus.</li>
        <li>
          Name it Affest. Description: Read my Creditcoin CC3 testnet vault and draft TCTC/ETH mixes. Never signs.
        </li>
        <li>MCP server URL is the ngrok URL ending in <code>/mcp</code>.</li>
        <li>Authentication is No authentication. The tunnel already injects the bearer.</li>
        <li>Check I trust this application, then Create or Connect.</li>
      </ol>
      <p>
        You should see tools such as <code>get_affest_account</code>, <code>get_active_strategies</code>, <code>draft_strategy</code>, and <code>explain_rebalance</code>.
      </p>

      <h2>6. Use it in a chat</h2>
      <p>
        Developer Mode connectors are off until you pick them in that conversation.
      </p>
      <ol>
        <li>Open a new chat.</li>
        <li>Click + next to the composer, then More, then Developer Mode.</li>
        <li>Enable Affest.</li>
        <li>Ask something the tools can answer.</li>
      </ol>
      <p>Prompts that work:</p>
      <ul>
        <li>Read my Affest account. Show CC3 TCTC, vault, and Sepolia ETH.</li>
        <li>List my live CC3 strategies.</li>
        <li>Draft a conservative TCTC/ETH mix. Do not try to sign anything.</li>
        <li>When is Affest allowed to rebalance?</li>
      </ul>
      <p>
        ChatGPT should call <code>get_affest_account</code>, <code>get_active_strategies</code>, <code>draft_strategy</code>, or <code>explain_rebalance</code>.
      </p>

      <h2>What it will not do</h2>
      <ul>
        <li>It will not sign <code>createStrategy</code>, wrap, deposit, or pause. Pause in MCP only tells you to use the dashboard.</li>
        <li>
          <code>draft_strategy</code> comes back with <code>executable: false</code>. You still create the strategy in Affest and sign in MetaMask.
        </li>
        <li>
          Rebalance still waits for a verified Sepolia <code>PortfolioSignal</code> on Creditcoin. See <Link href="/docs/proofs">Proofs</Link>.
        </li>
      </ul>

      <h2>If it breaks</h2>
      <table>
        <thead>
          <tr>
            <th>What you see</th>
            <th>Fix</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Connection failed, or not HTTPS</td>
            <td>Use the <code>https://…/mcp</code> ngrok URL, not localhost.</td>
          </tr>
          <tr>
            <td><code>401</code> bearer required</td>
            <td>Restart ngrok with <code>--request-header-add &quot;Authorization: Bearer aff_…&quot;</code>.</td>
          </tr>
          <tr>
            <td>Initialize <code>-32000</code></td>
            <td>The client must send <code>Accept: application/json, text/event-stream</code>. ChatGPT normally does.</td>
          </tr>
          <tr>
            <td>Connected, model never calls it</td>
            <td>Enable Affest from + in that chat, or say use Affest.</td>
          </tr>
          <tr>
            <td>Empty balances</td>
            <td>Credential was issued for a different wallet. Generate again on /agents while that wallet is connected, then restart ngrok with the new token.</td>
          </tr>
          <tr>
            <td>Tools vanish after ngrok restart</td>
            <td>Free ngrok URL changed. Edit the connector URL.</td>
          </tr>
        </tbody>
      </table>
      <p>
        Claude Code and Cursor can use <code>http://127.0.0.1:8787/mcp</code> plus the bearer header directly. ChatGPT cannot. That is the only extra hop. More errors are on <Link href="/docs/errors">Errors</Link>.
      </p>

      <DocsCards>
        <DocsCard href="/docs/mcp" title="MCP agents">
          Local HTTP, stdio, tools, and how to revoke a token.
        </DocsCard>
        <DocsCard href="/docs/security" title="Security">
          HMAC hashing, scopes, and why MCP never holds the wallet key.
        </DocsCard>
      </DocsCards>
    </DocsArticle>
  );
}
