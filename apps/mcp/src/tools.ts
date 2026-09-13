import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { AuthContext, CredentialStore } from './auth.js';
import { readLiveAccount, readPortfolioDiagnostics, type PortfolioDiagnostics, type PortfolioStrategyDiagnostic } from './live.js';
import { validateStrategy } from '@affest/strategy-engine';
import type { IndexedTrigger, PostgresWorkerIndex } from './worker-index.js';
import { encodeFunctionData, isAddress, type Hex } from 'viem';

const success = (data: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: { ok: true, data },
});

const failure = (error: string, data?: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ ok: false, error }, null, 2) }],
  structuredContent: { ok: false, error, ...(data === undefined ? {} : { data }) },
});

const outputSchema = z.object({ ok: z.boolean(), data: z.unknown().optional(), error: z.string().optional() });
const emptyInput = z.object({});
const strategyIdValue = z.union([z.string().trim().min(1), z.number().int().nonnegative()]);
const strategyInputFields = z.object({ strategyId: strategyIdValue.optional(), strategy_id: strategyIdValue.optional() });
const strategyInput = strategyInputFields.refine((value) => value.strategyId !== undefined || value.strategy_id !== undefined, { message: 'strategyId is required' });
const policyInput = z.object({ policy: z.unknown() });
const idempotentActionInput = strategyInputFields.extend({ idempotencyKey: z.string().max(128).optional() }).refine((value) => value.strategyId !== undefined || value.strategy_id !== undefined, { message: 'strategyId is required' });
const sourceTransactionInput = z.object({ transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), logIndex: z.number().int().nonnegative().optional() });
const proofInput = z.object({ transactionHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/), chainKey: z.number().int().nonnegative().default(1) });
const audits: Array<{ at: string; tool: string; userId: string; client: string }> = [];
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const executorAddress = process.env.AFFEST_EXECUTOR_ADDRESS;
const approveRebalanceAbi = [{ type: 'function', name: 'approveRebalance', stateMutability: 'nonpayable', inputs: [{ name: 'eventKey', type: 'bytes32' }], outputs: [{ name: 'amountOut', type: 'uint256' }] }] as const;
const eventKeySchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'eventKey must be a 32-byte hex value');
const approvalInput = z.object({ eventKey: eventKeySchema, idempotencyKey: z.string().min(8).max(128).optional() });

function eventKeyHex(value: string): Hex {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('eventKey must be a 32-byte hex value');
  return value as Hex;
}

type DiagnosticContext = {
  readonly diagnostics: PortfolioDiagnostics | null;
  readonly triggers: readonly IndexedTrigger[];
  readonly error?: { readonly code: 'CC3_READ_FAILED'; readonly message: string };
};

async function loadDiagnosticContext(userId: string, workerIndex?: PostgresWorkerIndex): Promise<DiagnosticContext> {
  const triggers = workerIndex ? await workerIndex.list(userId) : [];
  try {
    const diagnostics = await readPortfolioDiagnostics(userId, triggers.map((trigger) => ({ strategyId: trigger.strategyId, status: trigger.status })));
    return { diagnostics, triggers };
  } catch (error: unknown) {
    return { diagnostics: null, triggers, error: { code: 'CC3_READ_FAILED', message: error instanceof Error ? error.message : 'Creditcoin CC3 diagnostics could not be read.' } };
  }
}

function contextFailure(context: DiagnosticContext) {
  return context.error ? failure(context.error.code, { reason: context.error.message, nextAction: 'Check the Creditcoin CC3 RPC and contract configuration, then retry.' }) : undefined;
}

function findStrategy(context: DiagnosticContext, strategyId: string): PortfolioStrategyDiagnostic | undefined {
  return context.diagnostics?.strategies.find((item) => item.strategyId === strategyId);
}

function normalizedStrategyId(args: { readonly strategyId?: string | number | undefined; readonly strategy_id?: string | number | undefined }): string {
  const value = args.strategyId ?? args.strategy_id;
  return value === undefined ? '' : String(value).trim();
}

function strategyNotFound(strategyId: string) {
  return failure('STRATEGY_NOT_FOUND', { strategyId, reason: `Strategy #${strategyId} was not found for this wallet.`, nextAction: 'Use get_active_strategies or get_portfolio_diagnostics to choose an owned strategy.' });
}

function diagnosticBlocked(strategy: PortfolioStrategyDiagnostic) {
  return failure(strategy.readiness.code, {
    strategyId: strategy.strategyId,
    vault: strategy.vault,
    readiness: strategy.readiness,
    configuration: strategy.configuration,
    stableAsset: strategy.stableAsset,
    riskAsset: strategy.riskAsset,
    nativeTctc: strategy.nativeTctc,
    rebalance: strategy.rebalance,
    chain: strategy.chain,
  });
}

export function scopeForTool(tool: string): 'read' | 'plan' | 'proof' | 'action' {
  if (tool.startsWith('get_')) return 'read';
  if (['draft_strategy', 'validate_strategy', 'preview_rebalance', 'explain_rebalance', 'check_strategy_conditions'].includes(tool)) return 'plan';
  if (['find_source_transaction', 'check_source_transaction', 'check_attestation_readiness', 'build_attestcoin_proof', 'simulate_proof_verification'].includes(tool)) return 'proof';
  return 'action';
}

export function registerServer(auth: AuthContext, credentials: CredentialStore, workerIndex?: PostgresWorkerIndex): McpServer {
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
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const activeVault = context.diagnostics?.strategies.find((strategy) => strategy.status === 'ACTIVE')?.vault;
    const account = await readLiveAccount(auth.userId, activeVault ?? null);
    return success({ account, strategies: context.diagnostics?.strategies ?? [], chain: context.diagnostics?.chain ?? null, note: 'Active does not mean rebalance-ready. Read each strategy readiness status before requesting an action.' });
  });
  server.registerTool('get_portfolio', { description: 'Read live vault and wallet holdings.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolio');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const activeVault = context.diagnostics?.strategies.find((strategy) => strategy.status === 'ACTIVE')?.vault;
    const account = await readLiveAccount(auth.userId, activeVault ?? null);
    return success({ account, strategies: context.diagnostics?.strategies ?? [], chain: context.diagnostics?.chain ?? null });
  });
  server.registerTool('get_portfolio_diagnostics', { description: 'Diagnose every strategy vault owned by this wallet using live Creditcoin CC3 reads.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolio_diagnostics');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    if (!context.diagnostics) return failure('WALLET_REQUIRED', { userId: auth.userId, strategies: [] });
    return success(context.diagnostics);
  });
  server.registerTool('get_active_strategies', { description: 'List this wallet\'s live CC3 strategies.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_active_strategies');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    return success((context.diagnostics?.strategies ?? []).filter((strategy) => strategy.status === 'ACTIVE'));
  });
  server.registerTool('get_portfolio_allocation', { description: 'Read current and target TCTC/ETH allocation data for this wallet.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_portfolio_allocation');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const activeVault = context.diagnostics?.strategies.find((strategy) => strategy.status === 'ACTIVE')?.vault;
    const account = await readLiveAccount(auth.userId, activeVault ?? null);
    return success({ account, activeStrategy: context.diagnostics?.strategies.find((strategy) => strategy.status === 'ACTIVE') ?? null, strategies: context.diagnostics?.strategies ?? [], supportedAssets: ['WTCTC', 'ETH'], valuesAreLive: true });
  });
  server.registerTool('get_pending_actions', { description: 'List pending rebalance actions. Actions remain approval-gated.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_pending_actions');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const actions = context.triggers.filter((trigger) => trigger.status === 'approval-pending').map((trigger) => ({
      triggerId: trigger.id,
      strategyId: trigger.strategyId,
      ...(findStrategy(context, trigger.strategyId) ? { readiness: findStrategy(context, trigger.strategyId)?.readiness, vault: findStrategy(context, trigger.strategyId)?.vault } : {}),
      sourceTransactionHash: trigger.transactionHash,
      eventKey: typeof trigger.statusPayload.eventKey === 'string' ? trigger.statusPayload.eventKey : null,
      requestTransactionHash: typeof trigger.statusPayload.requestTransactionHash === 'string' ? trigger.statusPayload.requestTransactionHash : null,
      expiresAt: typeof trigger.statusPayload.expiresAt === 'string' ? trigger.statusPayload.expiresAt : null,
    }));
    return success({ actions, indexed: Boolean(workerIndex), ...(workerIndex ? {} : { note: 'The worker coordination database is not attached to this MCP instance.' }) });
  });
  server.registerTool('get_attestcoin_status', { description: 'Read Attestcoin proof lifecycle status for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_attestcoin_status');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const latest = context.triggers[0];
    return success({ sourceChain: 'ethereum-sepolia', status: latest?.status ?? 'not-indexed', verifiedOn: 'Creditcoin CC3 Testnet', ...(latest ? { sourceTransactionHash: latest.transactionHash, details: latest.statusPayload } : { note: 'Proof status is available after the worker coordination store is connected.' }), strategies: context.diagnostics?.strategies.map((strategy) => ({ strategyId: strategy.strategyId, vault: strategy.vault, readiness: strategy.readiness })) ?? [] });
  });
  server.registerTool('get_trigger_history', { description: 'List source-chain trigger history for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_trigger_history');
    const triggers = workerIndex ? await workerIndex.list(auth.userId) : [];
    return success({ triggers, indexed: Boolean(workerIndex) });
  });
  server.registerTool('get_execution_history', { description: 'List Creditcoin execution history for this account.', inputSchema: emptyInput, outputSchema }, async () => {
    record('get_execution_history');
    const triggers = workerIndex ? await workerIndex.list(auth.userId) : [];
    const executions = triggers.filter((trigger) => trigger.status === 'executed').map((trigger) => ({
      strategyId: trigger.strategyId,
      sourceTransactionHash: trigger.transactionHash,
      creditcoinTransactionHash: typeof trigger.statusPayload.transactionHash === 'string' ? trigger.statusPayload.transactionHash : null,
      status: trigger.status,
    }));
    return success({ executions, indexed: Boolean(workerIndex) });
  });
  server.registerTool('get_strategy', { description: 'Read one live CC3 strategy by id.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('get_strategy');
    const strategyId = normalizedStrategyId(args);
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const found = findStrategy(context, strategyId);
    return found ? success(found) : strategyNotFound(strategyId);
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
    const strategyId = normalizedStrategyId(args);
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const strategy = findStrategy(context, strategyId);
    if (!strategy) return strategyNotFound(strategyId);
    if (!strategy.readiness.possible) return diagnosticBlocked(strategy);
    return success({ strategyId, vault: strategy.vault, stableAsset: strategy.stableAsset, riskAsset: strategy.riskAsset, targetAllocation: strategy.targetAllocation, rebalance: strategy.rebalance, unsigned: true, requiresApproval: true, simulated: false, note: 'Swap simulation is not connected to the MCP service.' });
  });
  server.registerTool('explain_rebalance', { description: 'Explain whether a strategy vault can rebalance and why.', inputSchema: strategyInputFields.partial(), outputSchema }, async (args) => {
    record('explain_rebalance');
    const diagnostics = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(diagnostics);
    if (diagnosticsError) return diagnosticsError;
    const strategyId = args.strategyId === undefined && args.strategy_id === undefined ? undefined : normalizedStrategyId(args);
    const strategy = strategyId ? findStrategy(diagnostics, strategyId) : diagnostics.diagnostics?.strategies.find((item) => item.status === 'ACTIVE');
    if (!strategy) return strategyId ? strategyNotFound(strategyId) : failure('NO_ACTIVE_STRATEGY', { reason: 'No active strategy found for this wallet.', nextAction: 'Create or activate a strategy, then retry.' });
    return success({
      explanation: 'Affest rebalances a TCTC/ETH mix only after Creditcoin verifies an Attestcoin proof of a Sepolia PortfolioSignal. The MCP server never signs. Pause remains on-chain and independent of this credential.',
      verifiedSourceRequired: true,
      strategyId: strategy.strategyId,
      vault: strategy.vault,
      stableAsset: strategy.stableAsset,
      riskAsset: strategy.riskAsset,
      nativeTctc: strategy.nativeTctc,
      readiness: strategy.readiness,
      rebalance: strategy.rebalance,
      chain: strategy.chain,
    });
  });
  server.registerTool('check_strategy_conditions', { description: 'Check whether a strategy has a verified trigger and may be proposed.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('check_strategy_conditions');
    const strategyId = normalizedStrategyId(args);
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const strategy = findStrategy(context, strategyId);
    if (!strategy) return strategyNotFound(strategyId);
    const trigger = context.triggers.find((item) => item.strategyId === strategyId);
    const triggerEligible = trigger?.status === 'verified' || trigger?.status === 'approval-pending' || trigger?.status === 'executed';
    const blockers: string[] = [];
    if (!strategy.readiness.possible) blockers.push(strategy.readiness.reason ?? 'strategy preflight failed');
    if (!triggerEligible) blockers.push(trigger?.status ? `Attestcoin trigger is ${trigger.status}, not verified.` : 'No verified Attestcoin trigger is indexed for this strategy.');
    const eligible = triggerEligible && strategy.readiness.possible;
    return success({
      strategyId,
      eligible,
      strategyStatus: strategy.status,
      readiness: strategy.readiness,
      status: trigger?.status ?? 'not-indexed',
      stableAsset: strategy.stableAsset,
      riskAsset: strategy.riskAsset,
      nativeTctc: strategy.nativeTctc,
      rebalance: strategy.rebalance,
      blockers,
      nextAction: blockers[0] ?? 'Submit the guarded rebalance request.',
      ...(trigger ? { details: trigger.statusPayload } : { reason: 'No verified Attestcoin trigger is indexed for this strategy.' }),
      ...(!strategy.readiness.possible ? { reason: strategy.readiness.reason, nextAction: strategy.readiness.nextAction } : {}),
    });
  });
  server.registerTool('find_source_transaction', { description: 'Find a Sepolia source transaction by hash and optional log index.', inputSchema: sourceTransactionInput, outputSchema }, async (args) => {
    record('find_source_transaction');
    const found = workerIndex ? await workerIndex.find(auth.userId, args.transactionHash) : undefined;
    return success({ sourceChain: 'ethereum-sepolia', transactionHash: args.transactionHash, logIndex: args.logIndex ?? found?.logIndex ?? null, found: Boolean(found), indexed: Boolean(workerIndex), ...(found ? { status: found.status, details: found.statusPayload } : {}) });
  });
  server.registerTool('check_source_transaction', { description: 'Check source receipt and PortfolioSignal event readiness.', inputSchema: sourceTransactionInput, outputSchema }, async (args) => {
    record('check_source_transaction');
    const found = workerIndex ? await workerIndex.find(auth.userId, args.transactionHash) : undefined;
    const readyStatuses = ['source-confirmed', 'waiting-for-attestation', 'proof-ready', 'verified', 'approval-pending', 'executed'];
    return success({ sourceChain: 'ethereum-sepolia', transactionHash: args.transactionHash, ready: Boolean(found && readyStatuses.includes(found.status)), indexed: Boolean(workerIndex), ...(found ? { status: found.status } : { reason: 'Source monitor is not attached to this MCP instance.' }) });
  });
  server.registerTool('check_attestation_readiness', { description: 'Check whether Attestcoin can currently prove a source transaction.', inputSchema: proofInput, outputSchema }, async (args) => {
    record('check_attestation_readiness');
    const trigger = workerIndex ? await workerIndex.find(auth.userId, args.transactionHash) : undefined;
    const ready = Boolean(trigger && ['proof-ready', 'verified', 'approval-pending', 'executed'].includes(trigger.status));
    return success({ transactionHash: args.transactionHash, chainKey: args.chainKey, ready, indexed: Boolean(workerIndex), ...(trigger ? { status: trigger.status, details: trigger.statusPayload } : { reason: 'The worker has not indexed this source transaction.' }) });
  });
  server.registerTool('build_attestcoin_proof', { description: 'Build an Attestcoin proof when the worker integration is available.', inputSchema: proofInput, outputSchema }, async (args) => {
    record('build_attestcoin_proof');
    const trigger = workerIndex ? await workerIndex.find(auth.userId, args.transactionHash) : undefined;
    if (!trigger) return failure('source transaction is not indexed for this wallet');
    if (!trigger.proof) return failure(`proof is not ready; current status is ${trigger.status}`);
    return success({ transactionHash: args.transactionHash, chainKey: args.chainKey, proof: trigger.proof, persistedByWorker: true });
  });
  server.registerTool('simulate_proof_verification', { description: 'Simulate Creditcoin verification for a proof reference without submitting a transaction.', inputSchema: z.object({ proofReference: z.string().min(1) }), outputSchema }, async (args) => {
    record('simulate_proof_verification');
    const trigger = workerIndex ? await workerIndex.find(auth.userId, args.proofReference) : undefined;
    const verified = Boolean(trigger && ['verified', 'approval-pending', 'executed'].includes(trigger.status));
    return success({ proofReference: args.proofReference, simulated: Boolean(trigger), verified, indexed: Boolean(workerIndex), ...(trigger ? { status: trigger.status, details: trigger.statusPayload } : { reason: 'No worker simulation record is indexed for this proof reference.' }) });
  });
  server.registerTool('request_rebalance', { description: 'Request a guarded rebalance proposal. Never signs or submits.', inputSchema: idempotentActionInput, outputSchema }, async (args) => {
    record('request_rebalance');
    const strategyId = normalizedStrategyId(args);
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const strategy = findStrategy(context, strategyId);
    if (!strategy) return strategyNotFound(strategyId);
    if (!strategy.readiness.possible) return diagnosticBlocked(strategy);
    const trigger = context.triggers.find((item) => item.strategyId === strategyId);
    if (!trigger) return success({ strategyId, requestId: args.idempotencyKey ?? null, status: 'waiting-for-verified-trigger', requiresApproval: true, unsigned: true, note: 'The worker has not indexed a proof-backed trigger for this strategy.' });
    return success({ strategyId, requestId: args.idempotencyKey ?? null, status: trigger.status, requiresApproval: trigger.status === 'approval-pending', unsigned: true, sourceTransactionHash: trigger.transactionHash, details: trigger.statusPayload });
  });
  server.registerTool('prepare_approval_transaction', { description: 'Prepare an unsigned user approval transaction for a proof-verified pending rebalance.', inputSchema: approvalInput, outputSchema }, async (args) => {
    record('prepare_approval_transaction');
    if (!executorAddress || !isAddress(executorAddress)) return failure('AFFEST_EXECUTOR_ADDRESS is not configured on the MCP service');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const pending = context.triggers.find((item) => item.status === 'approval-pending' && item.statusPayload.eventKey === args.eventKey);
    if (!pending) return failure('approval-pending action not found for this wallet and eventKey');
    const strategy = findStrategy(context, pending.strategyId);
    if (!strategy) return strategyNotFound(pending.strategyId);
    if (strategy.status !== 'ACTIVE' || !strategy.configuration.valid || !strategy.rebalance.possible) return diagnosticBlocked(strategy);
    const data = encodeFunctionData({ abi: approveRebalanceAbi, functionName: 'approveRebalance', args: [eventKeyHex(args.eventKey)] });
    return success({ unsigned: true, readyToSign: true, to: executorAddress, data, value: '0', eventKey: args.eventKey, requestId: args.idempotencyKey ?? null });
  });
  server.registerTool('execute_authorized_rebalance', { description: 'Prepare the unsigned owner approval call for a proof-verified pending rebalance. This server never signs.', inputSchema: approvalInput, outputSchema }, async (args) => {
    record('execute_authorized_rebalance');
    if (!executorAddress || !isAddress(executorAddress)) return failure('AFFEST_EXECUTOR_ADDRESS is not configured on the MCP service');
    const context = await loadDiagnosticContext(auth.userId, workerIndex);
    const diagnosticsError = contextFailure(context);
    if (diagnosticsError) return diagnosticsError;
    const pending = context.triggers.find((item) => item.status === 'approval-pending' && item.statusPayload.eventKey === args.eventKey);
    if (!pending) return failure('approval-pending action not found for this wallet and eventKey');
    const strategy = findStrategy(context, pending.strategyId);
    if (!strategy) return strategyNotFound(pending.strategyId);
    if (strategy.status !== 'ACTIVE' || !strategy.configuration.valid || !strategy.rebalance.possible) return diagnosticBlocked(strategy);
    const data = encodeFunctionData({ abi: approveRebalanceAbi, functionName: 'approveRebalance', args: [eventKeyHex(args.eventKey)] });
    return success({ unsigned: true, readyToSign: true, to: executorAddress, data, value: '0', eventKey: args.eventKey, note: 'Review the pending action, then sign this call with the strategy owner wallet.' });
  });
  server.registerTool('pause_strategy', { description: 'Describe how to pause. Does not sign.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('pause_strategy');
    return success({ strategyId: normalizedStrategyId(args), unsigned: true, hint: 'Pause from the Affest strategy dashboard. MCP cannot hold the wallet key.' });
  });
  server.registerTool('resume_strategy', { description: 'Describe how to resume. Does not sign.', inputSchema: strategyInput, outputSchema }, async (args) => {
    record('resume_strategy');
    return success({ strategyId: normalizedStrategyId(args), unsigned: true, hint: 'Resume from the Affest strategy dashboard. MCP cannot hold the wallet key.' });
  });
  server.registerTool('revoke_agent_access', { description: 'Revoke this MCP credential immediately.', inputSchema: emptyInput, outputSchema }, async () => {
    record('revoke_agent_access');
    await credentials.revoke(auth.credentialId);
    return success({ revoked: true, credentialId: auth.credentialId });
  });
  return server;
}

export { audits };
