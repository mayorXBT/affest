# Affest remote MCP setup

The MCP server uses the official TypeScript SDK `1.30.0` and Streamable HTTP.
It is model-independent and can be configured as a remote server in any MCP
client that supports the current HTTP transport.

## Local server

```powershell
pnpm --filter @affest/mcp build
pnpm --filter @affest/mcp start
```

The process prints a local CLI token. Open Affest `/agents`, connect a wallet, and generate a credential. That token is bound to your address and is what Claude or GPT should send.

The endpoint is `http://localhost:8787/mcp`. Health is available at
`/health`.

Generate a credential through the wallet-signature challenge on the Agents
page. The raw token is returned once. The MCP service stores only an
HMAC-SHA256 hash. Set `DATABASE_URL` to a managed PostgreSQL connection string
from Supabase, Neon, or another PostgreSQL provider to persist credentials
across Render restarts. Without it, credentials remain in memory.

### Neon on Render

1. Create a Neon project and database.
2. Copy the pooled connection string from Neon. Keep the `sslmode=require`
   parameter.
3. Add the connection string to the Render MCP service as `DATABASE_URL`.
4. Keep the existing `MCP_TOKEN_HASH_SECRET` value unchanged. Changing it
   prevents existing bearer tokens from authenticating.
5. Redeploy the MCP service.

The MCP server creates the `affest_mcp_credentials` and
`affest_mcp_chatgpt_links` tables on startup. The worker creates its trigger
and cursor tables when it starts. You do not need to run a separate migration
for these tables.

```powershell
Invoke-RestMethod http://localhost:8787/credentials -Method Post `
  -Headers @{Authorization="Bearer one-time-admin-token"} `
  -ContentType 'application/json' `
  -Body '{"userId":"user-1","name":"Claude","scopes":["read","plan"]}'
```

Claude Code / Cursor HTTP config:

```json
{
  "mcpServers": {
    "affest": {
      "url": "http://127.0.0.1:8787/mcp",
      "headers": { "Authorization": "Bearer aff_YOUR_TOKEN" }
    }
  }
}
```

Claude Desktop stdio, from the repo root after build:

```json
{
  "mcpServers": {
    "affest": {
      "command": "node",
      "args": ["apps/mcp/dist/stdio.js"],
      "env": { "AFFEST_WALLET": "0xYourAddress" }
    }
  }
}
```

ChatGPT cannot hit localhost. For the hosted service, click **Copy persistent
read-only connection link** on the Agents page. The URL does not need a custom
`Authorization` header, and it remains valid until you revoke the parent MCP
credential. Treat the link like a bearer credential and do not publish it.

For local-only testing, tunnel 8787 over HTTPS and inject the bearer on the
tunnel:

```powershell
ngrok http 8787 --request-header-add "Authorization: Bearer aff_YOUR_TOKEN"
```

In ChatGPT, enable Developer Mode, create a connector with the ngrok `https://…/mcp` URL, and pick No authentication. Enable the connector from + in each new chat. The click path lives in the app docs at `/docs/chatgpt`.

Read tools query live CC3 and Sepolia balances for the wallet bound to the credential. Pause and rebalance tools never sign. The server does not hold browser keys.

## Hosted dashboard

The production dashboard is `https://affest.cefo.dev`. Set
`NEXT_PUBLIC_MCP_BASE_URL` in its Vercel project to the origin that hosts MCP,
for example `https://mcp.example.com`. Do not include `/mcp` in that value.

If a reverse proxy serves MCP from `affest.cefo.dev`, leave the variable empty.
The dashboard then uses same-origin `/health`, `/credentials`, and `/mcp`
requests. A Vercel dashboard with no reverse proxy and no
`NEXT_PUBLIC_MCP_BASE_URL` is intentionally marked **Not configured**; it must
not fall back to a laptop command or localhost.

The MCP service must also be configured with `MCP_BASE_URL` so credential
responses advertise the public `/mcp` URL rather than `127.0.0.1`. The live
Agents page uses a short-lived, origin-bound wallet signature challenge to
issue credentials remotely. `MCP_BOOTSTRAP_TOKEN` remains for server/operator
automation only and must never be exposed to the browser.

The MCP service is only the agent interface. Deploy the trigger/proof worker as
a separate Render Background Worker and give it the server-only chain,
database, relayer, and contract variables described in
[`docs/worker-deploy.md`](worker-deploy.md). Without that worker, read tools
can still work but no Sepolia event will progress to Attestcoin verification
or a Creditcoin rebalance.
