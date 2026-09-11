import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthContext, CredentialStore } from './auth.js';
import { readLiveAccount, readLiveStrategies } from './live.js';

const success = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: { ok: true, data },
});

const outputSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional() });
const emptyInput = z.object({});
const strategyInput = z.object({ strategyId: z.string().min(1) });
const audits: Array<{ at: string; tool: string; userId: string; client: string }> = [];
const rateBuckets = new Map<string, { startedAt: number; count: number }>();

export function scopeForTool(tool: string): 'read' | 'plan' | 'proof' | 'action' {
  if (tool.startsWith('get_')) return 'read';
  if (['draft_strategy', 'validate_strategy', 'preview_rebalance', 'explain_rebalance', 'check_strategy_conditions'].includes(tool)) return 'plan';
  if (['find_source_transaction', 'check_source_transaction', 'check_attestation_readiness', 'build_attestcoin_proof', 'simulate_proof_verification'].includes(tool)) return 'proof';
  return 'action';
}

export function registerServer(auth: AuthContext, credentials: CredentialStore): McpServer {
  const server = new McpServer({ name: 'affest-mcp', version: '0.1.0' });
  const record = (tool: string) => {
    const scope = scopeForTool(tool);
    if (!auth.scopes.includes(scope) && !auth.scopes.includes('*')) throw new Error(`missing scope: ${scope}`);
    const now = Date.now();
    const bucket = rateBuckets.get(auth.credentialId);
    if (!bucket || now - bucket.startedAt >= 60_000) rateBuckets.set(auth.credentialId, { startedAt: now, count: 1 });
    else if (bucket.count >= 60) throw new Error('rate limit exceeded');
    else bucket.count += 1;
    audits.push({ at: new Date().toISOString(), tool, userId: auth.userId, client: auth.clientName });
  };

  server.registerTool('get_affest_account', { description: 'Read the connected Affest wallet, CC3 TCTC, vault, and Sepolia ETH.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_affest_account');
    return success(await readLiveAccount(auth.userId));
  });
  server.registerTool('get_portfolios', { description: 'List the Affest vault and live balances for this wallet.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolios');
    const account = await readLiveAccount(auth.userId);
    return success([account]);
  });
  server.registerTool('get_portfolio', { description: 'Read live vault and wallet holdings.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolio');
    return success(await readLiveAccount(auth.userId));
  });
  server.registerTool('get_active_strategies', { description: 'List this wallet\'s live CC3 strategies.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_active_strategies');
    return success(await readLiveStrategies(auth.userId));
  });
  server.registerTool('get_strategy', { description: 'Read one live CC3 strategy by id.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('get_strategy');
    const all = await readLiveStrategies(auth.userId);
    const found = all.find((item) => item.id === args.strategyId);
    return success(found ?? { error: 'strategy not found for this wallet', strategyId: args.strategyId });
  });
  server.registerTool('draft_strategy', { description: 'Draft a TCTC/ETH mix from natural language. Never executable until the user signs createStrategy.', inputSchema: z.object({ instruction: z.string().min(1).max(2000) }), outputSchema }, async (args) => {
    record('draft_strategy');
    const tilt = /eth/i.test(args.instruction) && !/tctc|creditcoin|conservative/i.test(args.instruction);
    const core = /core|conservative|tctc/i.test(args.instruction);
    const tctc = tilt ? 3000 : core ? 7000 : 5000;
    return success({
      instruction: args.instruction,
      policy: {
        sourceChain: 'ethereum-sepolia',
        targetAllocation: [{ asset: 'TCTC', weightBps: tctc }, { asset: 'ETH', weightBps: 10_000 - tctc }],
        executionMode: 'HYBRID',
        requiresUserApproval: true,
        executable: false,
      },
    });
  });
  server.registerTool('explain_rebalance', { description: 'Explain when Affest is allowed to rebalance.', inputSchema: emptyInput, outputSchema }, async () => {
    record('explain_rebalance');
    return success({
      explanation: 'Affest rebalances a TCTC/ETH mix only after Creditcoin verifies an Attestcoin proof of a Sepolia PortfolioSignal. The MCP server never signs. Pause remains on-chain and independent of this credential.',
      verifiedSourceRequired: true,
    });
  });
  server.registerTool('pause_strategy', { description: 'Describe how to pause. Does not sign.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('pause_strategy');
    return success({ strategyId: args.strategyId, unsigned: true, hint: 'Pause from the Affest strategy dashboard. MCP cannot hold the wallet key.' });
  });
  server.registerTool('revoke_agent_access', { description: 'Revoke this MCP credential immediately.', inputSchema: emptyInput, outputSchema }, async () => {
    record('revoke_agent_access');
    credentials.revoke(auth.credentialId);
    return success({ revoked: true, credentialId: auth.credentialId });
  });
  return server;
}

export { audits };
