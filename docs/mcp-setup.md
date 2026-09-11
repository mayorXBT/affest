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

Generate a credential through the bootstrap-protected endpoint. The raw token
is returned once and is never stored; only an HMAC-SHA256 hash is retained in
the credential store (Postgres persistence is the next integration step).

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

ChatGPT cannot hit localhost. Tunnel 8787 over HTTPS and inject the bearer on the tunnel, because ChatGPT usually cannot set `Authorization`:

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
requests.
