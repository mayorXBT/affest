'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bot, Lock } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAccount } from 'wagmi';
import { mcpBaseUrl, mcpConfigured } from '@/lib/public-config';

const MCP_URL = mcpBaseUrl;
const MCP_ENDPOINT = `${MCP_URL}/mcp`;
const STORE_KEY = 'affest.mcp.credential';

type Issued = {
  token: string;
  credentialId: string;
  wallet: string;
  name: string;
};

function readIssued(): Issued | undefined {
  if (typeof window === 'undefined') return undefined;
  const raw = window.localStorage.getItem(STORE_KEY);
  if (!raw) return undefined;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return undefined;
    const row = parsed as Record<string, unknown>;
    if (typeof row.token !== 'string' || typeof row.credentialId !== 'string') return undefined;
    return { token: row.token, credentialId: row.credentialId, wallet: String(row.wallet ?? ''), name: String(row.name ?? 'Claude') };
  } catch {
    return undefined;
  }
}

export function AgentTeaser() {
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    setConnected(Boolean(readIssued()));
  }, []);

  return (
    <Card className="min-h-[216px] p-[22px_23px]">
      <CardHeader>
        <div>
          <p className="eyebrow">Agent access</p>
          <CardTitle>Your copilots</CardTitle>
        </div>
        <Bot size={20} className="text-blue" />
      </CardHeader>
      <CardContent>
        <div className="my-5 flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-full bg-[#8b9bff17] text-blue">
            <Bot size={20} />
          </div>
          <div>
            <b className="block text-[12px]">{connected ? 'MCP credential issued' : 'No agents connected'}</b>
            <p className="mt-1 mb-0 text-[12px] leading-relaxed text-[#7c8889]">
              Give Claude or GPT a scoped window into your portfolio.
            </p>
          </div>
        </div>
        <Button variant="secondary" size="full" asChild>
          <Link href="/agents">{connected ? 'Manage agent access' : 'Connect an agent'}</Link>
        </Button>
        <small className="mt-3 flex items-center justify-center gap-1 text-[11px] text-[#617073]">
          <Lock size={12} /> Credentials are revocable and hashed at rest.
        </small>
      </CardContent>
    </Card>
  );
}

export function AgentCredentials() {
  const { address, isConnected } = useAccount();
  const [issued, setIssued] = useState<Issued | undefined>();
  const [online, setOnline] = useState<boolean | undefined>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIssued(readIssued());
    if (!mcpConfigured) {
      setOnline(false);
      return;
    }
    void fetch(`${MCP_URL}/health`).then((response) => setOnline(response.ok)).catch(() => setOnline(false));
  }, []);

  async function generate() {
    if (!isConnected || !address) {
      toast('Connect a wallet first so the agent reads your account');
      return;
    }
    if (!mcpConfigured) {
      toast('MCP is not configured for this deployment. Set NEXT_PUBLIC_MCP_BASE_URL in Vercel, then redeploy.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`${MCP_URL}/credentials`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: address, name: 'Claude', scopes: ['read', 'plan', 'proof', 'action'] }),
      });
      if (!response.ok) {
        toast(response.status === 401
          ? 'The MCP service rejected credential issuance. Configure its dashboard origin and bootstrap flow.'
          : 'Could not issue credential from the MCP service');
        return;
      }
      const body: unknown = await response.json();
      if (!body || typeof body !== 'object') throw new Error('bad credential payload');
      const row = body as Record<string, unknown>;
      if (typeof row.token !== 'string' || typeof row.credentialId !== 'string') throw new Error('bad credential payload');
      const next = { token: row.token, credentialId: row.credentialId, wallet: address, name: 'Claude' };
      window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
      setIssued(next);
      try {
        await navigator.clipboard.writeText(next.token);
        toast('MCP credential issued and copied');
      } catch {
        toast('MCP credential issued. Use Copy next to the token.');
      }
    } catch {
      toast(`MCP server is not reachable${MCP_URL ? ` at ${MCP_URL}` : ''}`);
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (!issued) return;
    try {
      await fetch(`${MCP_URL}/credentials/revoke`, {
        method: 'POST',
        headers: { authorization: `Bearer ${issued.token}` },
      });
    } catch {
      /* local revoke still stands */
    }
    window.localStorage.removeItem(STORE_KEY);
    setIssued(undefined);
    toast('MCP credential revoked');
  }

  const claudeHttp = issued
    ? JSON.stringify({
      mcpServers: {
        affest: {
          url: MCP_ENDPOINT,
          headers: { Authorization: `Bearer ${issued.token}` },
        },
      },
    }, null, 2)
    : '';
  const claudeStdio = issued
    ? JSON.stringify({
      mcpServers: {
        affest: {
          command: 'node',
          args: ['apps/mcp/dist/stdio.js'],
          env: { AFFEST_WALLET: issued.wallet },
        },
      },
    }, null, 2)
    : '';

  return (
    <div className="mt-7 grid gap-3.5 lg:grid-cols-2">
      <Card className="min-h-[260px] p-[22px_23px]">
        <CardHeader>
          <div>
            <p className="eyebrow">Credentials</p>
            <CardTitle>{issued ? 'Active credential' : 'No active credentials'}</CardTitle>
          </div>
          <Badge>{!mcpConfigured ? 'Not configured' : online === false ? 'Server offline' : issued ? 'Active' : 'None'}</Badge>
        </CardHeader>
        <CardContent>
          {issued ? (
            <>
              <div className="my-6">
                <label className="mb-1 block text-[11px] text-[#6f7c7d]">Bearer token</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={issued.token}
                    onFocus={(event) => event.currentTarget.select()}
                    onClick={(event) => event.currentTarget.select()}
                    className="h-9 min-w-0 flex-1 rounded-md border border-[#3e4b4c] bg-[#101618] px-2 font-mono text-[11px] text-[#a7b3aa] outline-none"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(issued.token);
                      toast('Token copied');
                    }}
                  >
                    Copy
                  </Button>
                </div>
                <small className="mt-1.5 block font-sans text-[11px] text-[#6f7c7d]">Bound to {issued.wallet.slice(0, 6)}…{issued.wallet.slice(-4)}</small>
              </div>
              <div className="mb-5 flex gap-1.5">
                {['read', 'plan', 'proof', 'action'].map((scope) => (
                  <span key={scope} className="rounded-sm bg-[#222d32] px-1.5 py-1 font-mono text-[11px] text-[#adbac0]">
                    {scope}
                  </span>
                ))}
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">Revoke credential</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Revoke agent access?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Claude and GPT will lose this token immediately. On-chain strategies stay as they are.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="border border-danger-line bg-danger-bg text-danger hover:bg-[#3a2422]"
                      onClick={() => void revoke()}
                    >
                      Revoke credential
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <p className="my-6 text-[12px] leading-relaxed text-[#899596]">
                {mcpConfigured
                  ? 'Connect a wallet, then issue a scoped token for Claude or GPT.'
                  : 'The live dashboard is missing its hosted MCP origin. Set NEXT_PUBLIC_MCP_BASE_URL in Vercel to the deployed MCP service, then redeploy.'}
              </p>
              <Button disabled={busy} onClick={() => void generate()}>
                Generate MCP credential
              </Button>
            </>
          )}
        </CardContent>
      </Card>
      <Card className="min-h-[260px] p-[22px_23px]">
        <p className="eyebrow">Server</p>
        <CardTitle className="mb-3">Connection details</CardTitle>
        <div className="mt-3 flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
          <span>Status</span>
          <b className={online ? 'text-[#8fef9a]' : 'text-[#f0b3a5]'}>{online === undefined ? 'Checking' : online ? 'Online' : 'Offline'}</b>
        </div>
        <div className="flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
          <span>Endpoint</span>
          <code className="font-mono text-[12px] text-[#c5cfca]">{mcpConfigured ? MCP_ENDPOINT : 'Not configured'}</code>
        </div>
        <div className="flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
          <span>Transport</span>
          <b className="text-[#c5cfca]">Streamable HTTP + stdio</b>
        </div>
        {issued ? (
          <div className="mt-4 space-y-3">
            <div>
              <b className="block text-[12px]">Claude Code / Cursor</b>
              <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-[#101618] p-2 font-mono text-[10px] text-[#c5cfca]">{claudeHttp}</pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  void navigator.clipboard.writeText(claudeHttp);
                  toast('Claude HTTP config copied');
                }}
              >
                Copy HTTP config
              </Button>
            </div>
            <div>
              <b className="block text-[12px]">Claude Desktop</b>
              <pre className="mt-1 max-h-36 overflow-auto rounded-md bg-[#101618] p-2 font-mono text-[10px] text-[#c5cfca]">{claudeStdio}</pre>
              <Button
                variant="outline"
                size="sm"
                className="mt-1"
                onClick={() => {
                  void navigator.clipboard.writeText(claudeStdio);
                  toast('Claude Desktop config copied');
                }}
              >
                Copy stdio config
              </Button>
            </div>
            <small className="block text-[11px] leading-relaxed text-[#829088]">
              ChatGPT needs a public HTTPS URL. Set <code>NEXT_PUBLIC_MCP_BASE_URL</code> to the hosted MCP origin, then use the same bearer token.
            </small>
          </div>
        ) : (
          <div className="mt-5 rounded-md border border-[#334039] bg-[#17201b] p-3">
            <b className="block text-[12px] text-[#bcd1ad]">{mcpConfigured ? 'MCP is a real server' : 'MCP service needs configuration'}</b>
            <small className="mt-1 block text-[12px] leading-relaxed text-[#829088]">
              {mcpConfigured
                ? 'It is not the fake credential toggle. Issue a token, then paste the config into Claude or GPT.'
                : 'This dashboard cannot issue credentials until NEXT_PUBLIC_MCP_BASE_URL points to a deployed MCP service.'}
            </small>
          </div>
        )}
      </Card>
    </div>
  );
}
