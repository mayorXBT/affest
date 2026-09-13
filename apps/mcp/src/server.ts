import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { getAddress, isAddress, isHex, verifyMessage } from 'viem';
import { z } from 'zod';
import { ChatgptLinkStore, CredentialStore, PostgresCredentialPersistence } from './auth.js';
import { registerServer } from './tools.js';
import { PostgresWorkerIndex } from './worker-index.js';

const port = Number(process.env.PORT ?? 8787);
const bootstrapToken = process.env.MCP_BOOTSTRAP_TOKEN ?? 'affest-local';
const tokenSecret = process.env.MCP_TOKEN_HASH_SECRET ?? randomBytes(32).toString('hex');
const publicMcpBaseUrl = (process.env.MCP_BASE_URL?.trim() || `http://127.0.0.1:${port}`).replace(/\/+$/, '');
const buildVersion = process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT_SHA ?? 'request-logging-enabled';
const persistence = process.env.DATABASE_URL ? new PostgresCredentialPersistence(process.env.DATABASE_URL) : undefined;
const credentials = new CredentialStore(tokenSecret, persistence);
await credentials.ready();
const chatgptLinks = new ChatgptLinkStore(tokenSecret, persistence);
await chatgptLinks.ready();
const workerIndex = process.env.DATABASE_URL ? new PostgresWorkerIndex(process.env.DATABASE_URL) : undefined;
const localToken = await credentials.issue('local', 'local-cli', ['read', 'plan', 'proof', 'action']);
const challengeTtlMs = 5 * 60 * 1000;
const challenges = new Map<string, { nonce: string; message: string; userId: string; origin: string; expiresAt: number }>();

function logEvent(event: string, fields: Record<string, unknown> = {}): void {
  process.stdout.write(`${JSON.stringify({ level: 30, time: Date.now(), event, ...fields })}\n`);
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : undefined;
}

function requestShape(body: unknown): Record<string, unknown> {
  const root = recordValue(body);
  const params = recordValue(root?.params);
  const argumentsValue = recordValue(params?.arguments);
  return {
    bodyType: body === undefined ? 'empty' : Array.isArray(body) ? 'array' : typeof body,
    rpcMethod: typeof root?.method === 'string' ? root.method : undefined,
    tool: typeof params?.name === 'string' ? params.name : undefined,
    argumentKeys: argumentsValue ? Object.keys(argumentsValue).sort() : [],
  };
}

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

function requestOrigin(req: IncomingMessage): string {
  return req.headers.origin ?? 'unknown';
}

function challengeKey(origin: string, userId: string): string {
  return `${origin}:${userId.toLowerCase()}`;
}

function challengeMessage(userId: string, nonce: string, origin: string, expiresAt: number): string {
  return [
    'Affest MCP access',
    `Origin: ${origin}`,
    `Wallet: ${userId}`,
    `Nonce: ${nonce}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    '',
    'Sign this message to issue a revocable Affest MCP credential.',
  ].join('\n');
}

function isHexSignature(value: string): boolean {
  return isHex(value) && value.length >= 4;
}

const httpServer = createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  const requestPath = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).pathname;
  if (requestPath === '/' && req.method === 'GET') return json(res, 200, { ok: true, service: 'affest-mcp', version: buildVersion, health: '/health', mcp: '/mcp' });
  if ((requestPath === '/health' || requestPath === '/mcp/health') && req.method === 'GET') return json(res, 200, { ok: true, service: 'affest-mcp', version: buildVersion });
  if (requestPath === '/credentials/challenge' && req.method === 'GET') {
    const wallet = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).searchParams.get('wallet');
    if (!wallet || !isAddress(wallet)) return json(res, 400, { error: 'valid wallet address required' });
    const userId = getAddress(wallet);
    const origin = requestOrigin(req);
    const nonce = randomBytes(16).toString('hex');
    const expiresAt = Date.now() + challengeTtlMs;
    const message = challengeMessage(userId, nonce, origin, expiresAt);
    challenges.set(challengeKey(origin, userId), { nonce, message, userId, origin, expiresAt });
    return json(res, 200, { nonce, message, expiresAt });
  }
  if (requestPath === '/credentials' && req.method === 'POST') {
    const bootstrapOk = req.headers.authorization === `Bearer ${bootstrapToken}`;
    const body = await readBody(req);
    const input = z.object({
      userId: z.string().min(1),
      name: z.string().min(1),
      scopes: z.array(z.string()).min(1).default(['read', 'plan', 'proof', 'action']),
      nonce: z.string().min(1).optional(),
      signature: z.string().min(1).optional(),
    }).safeParse(body);
    if (!input.success) return json(res, 400, { error: 'invalid credential request' });
    const localOk = isLocalDashboard(req);
    let userId = input.data.userId;
    if (!localOk && !bootstrapOk) {
      const nonce = input.data.nonce;
      const signature = input.data.signature;
      if (!nonce || !signature || !isHexSignature(signature) || !isAddress(input.data.userId)) {
        return json(res, 401, { error: 'wallet signature required' });
      }
      const address = getAddress(input.data.userId);
      userId = address;
      const origin = requestOrigin(req);
      const challenge = challenges.get(challengeKey(origin, address));
      if (!challenge || challenge.nonce !== nonce || challenge.expiresAt <= Date.now()) {
        return json(res, 401, { error: 'credential challenge expired or invalid' });
      }
      const hexSignature: `0x${string}` = `0x${signature.slice(2)}`;
      let validSignature = false;
      try {
        validSignature = await verifyMessage({ address, message: challenge.message, signature: hexSignature });
      } catch {
        validSignature = false;
      }
      if (!validSignature) return json(res, 401, { error: 'invalid wallet signature' });
      challenges.delete(challengeKey(origin, address));
    }
    const issued = await credentials.issue(userId, input.data.name, input.data.scopes);
    return json(res, 201, { token: issued.token, credentialId: issued.record.id, expiresAt: null, mcp: `${publicMcpBaseUrl}/mcp` });
  }
  if (requestPath === '/credentials/chatgpt-link' && req.method === 'POST') {
    const auth = await credentials.authenticate(req.headers.authorization);
    if (!auth) return json(res, 401, { error: 'valid Affest bearer credential required' });
    const ticket = await chatgptLinks.issue(auth);
    return json(res, 201, { url: `${publicMcpBaseUrl}/mcp?ticket=${ticket}`, scopes: ['read'], note: 'Persistent read-only connection URL. Revoke the parent credential to disable it.' });
  }
  if (requestPath === '/credentials/revoke' && req.method === 'POST') {
    const auth = await credentials.authenticate(req.headers.authorization);
    if (!auth) return json(res, 401, { error: 'valid Affest bearer credential required' });
    await credentials.revoke(auth.credentialId);
    return json(res, 200, { revoked: true, credentialId: auth.credentialId });
  }
  if (requestPath !== '/mcp') return json(res, 404, { error: 'not found' });
  const requestId = randomBytes(8).toString('hex');
  logEvent('mcp.request.received', { requestId, method: req.method, path: requestPath, hasAuthorization: Boolean(req.headers.authorization), hasSession: Boolean(req.headers['mcp-session-id']) });
  let auth = await credentials.authenticate(req.headers.authorization);
  if (!auth) {
    const ticket = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`).searchParams.get('ticket');
    if (ticket) auth = await chatgptLinks.authenticate(ticket, credentials);
  }
  if (!auth) {
    logEvent('mcp.request.auth_rejected', { requestId });
    return json(res, 401, { error: 'valid Affest bearer credential required' });
  }
  if (req.method !== 'POST' && req.method !== 'GET' && req.method !== 'DELETE') return json(res, 405, { error: 'method not allowed' });
  const requestBody = req.method === 'POST' ? await readBody(req) : undefined;
  logEvent('mcp.request.pre_validation', { requestId, ...requestShape(requestBody) });
  // A fresh transport per request is the SDK's stateless Streamable HTTP mode.
  const transport = new StreamableHTTPServerTransport();
  const server = registerServer(auth, credentials, workerIndex);
  await server.connect(transport as unknown as Transport);
  try {
    await transport.handleRequest(req, res, requestBody);
  } catch (error: unknown) {
    logEvent('mcp.request.error', { requestId, error: error instanceof Error ? error.message : 'unknown transport error' });
    throw error;
  } finally {
    await server.close();
  }
});

httpServer.listen(port, () => {
  logEvent('mcp.server.started', { baseUrl: publicMcpBaseUrl, version: buildVersion });
  process.stdout.write(`Affest MCP listening on ${publicMcpBaseUrl}/mcp\n`);
  process.stdout.write(`Local CLI token: ${localToken.token}\n`);
  process.stdout.write(`Bootstrap token: ${bootstrapToken}\n`);
});

export { httpServer, credentials, localToken };
