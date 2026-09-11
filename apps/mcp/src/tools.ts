import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthContext, CredentialStore } from './auth.js';
import { readLiveAccount, readLiveStrategies } from './live.js';
import { validateStrategy } from '@affest/strategy-engine';

const success = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: { ok: true, data },
});

const failure = (error: string) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error }, null, 2) }],
  structuredContent: { ok: false, error },
});

const outputSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional() });
const emptyInput = z.object({});
const strategyInput = z.object({ strategyId: z.string().min(1) });
const policyInput = z.object({ policy: z.unknown() });
const idempotentActionInput = strategyInput.extend({ idempotencyKey: z.string().min(8).max(128).optional() });
const sourceTransactionInput = z.object({ transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), logIndex: z.number().int().nonnegative().optional() });
const proofInput = z.object({ transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chainKey: z.number().int().nonnegative().default(1) });
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
  server.registerTool('get_portfolio_allocation', { description: 'Read current and target TCTC/ETH allocation data for this wallet.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolio_allocation');
    const [account, strategies] = await Promise.all([readLiveAccount(auth.userId), readLiveStrategies(auth.userId)]);
    return success({ account, activeStrategy: strategies[0] ?? null, supportedAssets: ['TCTC', 'ETH'], valuesAreLive: true });
  });
  server.registerTool('get_pending_actions', { description: 'List pending rebalance actions. Actions remain approval-gated.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_pending_actions');
    return success({ actions: [], indexed: false, note: 'The coordination database is not attached to this MCP instance yet.' });
  });
  server.registerTool('get_attestcoin_status', { description: 'Read Attestcoin proof lifecycle status for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_attestcoin_status');
    return success({ sourceChain: 'ethereum-sepolia', status: 'not-indexed', verifiedOn: 'Creditcoin CC3 Testnet', note: 'Proof status is available after the worker coordination store is connected.' });
  });
  server.registerTool('get_trigger_history', { description: 'List source-chain trigger history for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_trigger_history');
    return success({ triggers: [], indexed: false });
  });
  server.registerTool('get_execution_history', { description: 'List Creditcoin execution history for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_execution_history');
    return success({ executions: [], indexed: false });
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
  server.registerTool('validate_strategy', { description: 'Validate a deterministic strategy policy without activating it.', inputSchema: policyInput, outputSchema }, async (args) => {
    record('validate_strategy');
    const result = validateStrategy(args.policy);
    return result.ok ? success({ valid: true, policy: result.value }) : failure(result.errors.join('; '));
  });
  server.registerTool('preview_rebalance', { description: 'Prepare a non-signing rebalance preview for a strategy.', inputSchema: idempotentActionInput, outputSchema }, async (args) => {
    record('preview_rebalance');
    const strategies = await readLiveStrategies(auth.userId);
    const strategy = strategies.find((item) => item.id === args.strategyId);
    if (!strategy) return failure('strategy not found for this wallet');
    return success({ strategyId: args.strategyId, strategy, unsigned: true, requiresApproval: true, simulated: false, note: 'Swap simulation is not connected to the MCP service.' });
  });
  server.registerTool('explain_rebalance', { description: 'Explain when Affest is allowed to rebalance.', inputSchema: emptyInput, outputSchema }, async () => {
    record('explain_rebalance');
    return success({
      explanation: 'Affest rebalances a TCTC/ETH mix only after Creditcoin verifies an Attestcoin proof of a Sepolia PortfolioSignal. The MCP server never signs. Pause remains on-chain and independent of this credential.',
      verifiedSourceRequired: true,
    });
  });
  server.registerTool('check_strategy_conditions', { description: 'Check whether a strategy has a verified trigger and may be proposed.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('check_strategy_conditions');
    const strategies = await readLiveStrategies(auth.userId);
    if (!strategies.some((item) => item.id === args.strategyId)) return failure('strategy not found for this wallet');
    return success({ strategyId: args.strategyId, eligible: false, reason: 'No verified Attestcoin trigger is indexed for this strategy.' });
  });
  server.registerTool('find_source_transaction', { description: 'Find a Sepolia source transaction by hash and optional log index.', inputSchema: sourceTransactionInput, outputSchema }, async (args) => {
    record('find_source_transaction');
    return success({ sourceChain: 'ethereum-sepolia', transactionHash: args.transactionHash, logIndex: args.logIndex ?? null, found: false, indexed: false });
  });
  server.registerTool('check_source_transaction', { description: 'Check source receipt and PortfolioSignal event readiness.', inputSchema: sourceTransactionInput, outputSchema }, async (args) => {
    record('check_source_transaction');
    return success({ sourceChain: 'ethereum-sepolia', transactionHash: args.transactionHash, ready: false, reason: 'Source monitor is not attached to this MCP instance.' });
  });
  server.registerTool('check_attestation_readiness', { description: 'Check whether Attestcoin can currently prove a source transaction.', inputSchema: proofInput, outputSchema }, async (args) => {
    record('check_attestation_readiness');
    return success({ transactionHash: args.transactionHash, chainKey: args.chainKey, ready: false, reason: 'Attestation worker status is not attached to this MCP instance.' });
  });
  server.registerTool('build_attestcoin_proof', { description: 'Build an Attestcoin proof when the worker integration is available.', inputSchema: proofInput, outputSchema }, async (args) => {
    record('build_attestcoin_proof');
    return failure(`proof builder is not connected for ${args.transactionHash}`);
  });
  server.registerTool('simulate_proof_verification', { description: 'Simulate Creditcoin verification for a proof reference without submitting a transaction.', inputSchema: z.object({ proofReference: z.string().min(1) }), outputSchema }, async (args) => {
    record('simulate_proof_verification');
    return success({ proofReference: args.proofReference, simulated: false, verified: false, reason: 'Creditcoin proof simulator is not attached to this MCP instance.' });
  });
  server.registerTool('request_rebalance', { description: 'Request a guarded rebalance proposal. Never signs or submits.', inputSchema: idempotentActionInput, outputSchema }, async (args) => {
    record('request_rebalance');
    return success({ strategyId: args.strategyId, requestId: args.idempotencyKey ?? null, status: 'approval-required', requiresApproval: true, unsigned: true });
  });
  server.registerTool('prepare_approval_transaction', { description: 'Prepare an unsigned user approval transaction for a proposed rebalance.', inputSchema: idempotentActionInput, outputSchema }, async (args) => {
    record('prepare_approval_transaction');
    return success({ strategyId: args.strategyId, requestId: args.idempotencyKey ?? null, unsigned: true, readyToSign: false, reason: 'No proposed action is indexed for this strategy.' });
  });
  server.registerTool('execute_authorized_rebalance', { description: 'Execute only an on-chain-authorized rebalance. This server never signs.', inputSchema: idempotentActionInput, outputSchema }, async () => {
    record('execute_authorized_rebalance');
    return failure('execution is unavailable until a verified proof-backed action and authorized executor are connected');
  });
  server.registerTool('pause_strategy', { description: 'Describe how to pause. Does not sign.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('pause_strategy');
    return success({ strategyId: args.strategyId, unsigned: true, hint: 'Pause from the Affest strategy dashboard. MCP cannot hold the wallet key.' });
  });
  server.registerTool('resume_strategy', { description: 'Describe how to resume. Does not sign.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('resume_strategy');
    return success({ strategyId: args.strategyId, unsigned: true, hint: 'Resume from the Affest strategy dashboard. MCP cannot hold the wallet key.' });
  });
  server.registerTool('revoke_agent_access', { description: 'Revoke this MCP credential immediately.', inputSchema: emptyInput, outputSchema }, async () => {
    record('revoke_agent_access');
    await credentials.revoke(auth.credentialId);
    return success({ revoked: true, credentialId: auth.credentialId });
  });
  return server;
}

export { audits };
