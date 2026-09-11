import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';
import { CredentialStore } from './auth.js';
import { registerServer } from './tools.js';

const port = Number(process.env.PORT ?? 8787);
const bootstrapToken = process.env.MCP_BOOTSTRAP_TOKEN ?? 'affest-local';
const tokenSecret = process.env.MCP_TOKEN_HASH_SECRET ?? randomBytes(32).toString('hex');
const publicMcpBaseUrl = (process.env.MCP_BASE_URL?.trim() || `http://127.0.0.1:${port}`).replace(/\/+$/, '');
const credentials = new CredentialStore(tokenSecret);
const localToken = credentials.issue('local', 'local-cli', ['read', 'plan', 'proof', 'action']);

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function cors(res: ServerResponse) {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('access-control-allow-headers', 'authorization,content-type,mcp-protocol-version,mcp-session-id');
}

function json(res: ServerResponse, status: number, body: unknown): void {
  cors(res);
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(body));
}

function isLocalDashboard(req: IncomingMessage) {
  const origin = req.headers.origin ?? '';
  return origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
}

const httpServer = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const requestPath = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
  if (requestPath === '/' && req.method === 'GET') return json(res, 200, { ok: true, service: 'affest-mcp', health: '/health', mcp: '/mcp' });
  if ((requestPath === '/health' || requestPath === '/mcp/health') && req.method === 'GET') return json(res, 200, { ok: true, service: 'affest-mcp' });
  if (requestPath === '/credentials' && req.method === 'POST') {
    const bootstrapOk = req.headers.authorization === `Bearer ${bootstrapToken}`;
    if (!isLocalDashboard(req) && !bootstrapOk) return json(res, 401, { error: 'bootstrap authorization required' });
    const body = await readBody(req);
    const input = z.object({
      userId: z.string().min(1),
      name: z.string().min(1),
      scopes: z.array(z.string()).min(1).default(['read', 'plan', 'proof', 'action']),
    }).safeParse(body);
    if (!input.success) return json(res, 400, { error: 'invalid credential request' });
    const issued = credentials.issue(input.data.userId, input.data.name, input.data.scopes);
    return json(res, 201, { token: issued.token, credentialId: issued.record.id, expiresAt: issued.record.expiresAt, mcp: `${publicMcpBaseUrl}/mcp` });
  }
  if (requestPath === '/credentials/revoke' && req.method === 'POST') {
    const auth = credentials.authenticate(req.headers.authorization);
    if (!auth) return json(res, 401, { error: 'valid Affest bearer credential required' });
    credentials.revoke(auth.credentialId);
    return json(res, 200, { revoked: true, credentialId: auth.credentialId });
  }
  if (requestPath !== '/mcp') return json(res, 404, { error: 'not found' });
  const auth = credentials.authenticate(req.headers.authorization);
  if (!auth) return json(res, 401, { error: 'valid Affest bearer credential required' });
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') return json(res, 405, { error: 'method not allowed' });
  const transport = new StreamableHTTPServerTransport();
  const server = registerServer(auth, credentials);
  await server.connect(transport as unknown as Transport);
  try {
    await transport.handleRequest(req, res, req.method === 'POST' ? await readBody(req) : undefined);
  } finally {
    await server.close();
  }
});

httpServer.listen(port, () => {
  process.stdout.write(`Affest MCP listening on ${publicMcpBaseUrl}/mcp\n`);
  process.stdout.write(`Local CLI token: ${localToken.token}\n`);
  process.stdout.write(`Bootstrap token: ${bootstrapToken}\n`);
});

export { httpServer, credentials, localToken };
