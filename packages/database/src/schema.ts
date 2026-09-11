import { bigint, boolean, integer, jsonb, pgTable, text, timestamp, uuid, uniqueIndex } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  walletAddress: text('wallet_address').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const portfolios = pgTable('portfolios', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  vaultAddress: text('vault_address').notNull().unique(),
  name: text('name').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const strategies = pgTable('strategies', {
  id: uuid('id').primaryKey().defaultRandom(),
  portfolioId: uuid('portfolio_id').notNull().references(() => portfolios.id),
  onchainStrategyId: bigint('onchain_strategy_id', { mode: 'bigint' }),
  naturalLanguageInstruction: text('natural_language_instruction').notNull(),
  deterministicPolicyJson: jsonb('deterministic_policy_json').notNull(),
  executionMode: text('execution_mode').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const agentCredentials = pgTable('agent_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  credentialHash: text('credential_hash').notNull().unique(),
  scopes: text('scopes').array().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const triggerEvents = pgTable('trigger_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id),
  sourceChain: text('source_chain').notNull(),
  sourceTransactionHash: text('source_transaction_hash').notNull(),
  logIndex: integer('log_index').notNull(),
  status: text('status').notNull(),
  statusPayload: jsonb('status_payload').notNull(),
  attestationStatus: text('attestation_status').notNull(),
  proofReference: text('proof_reference'),
  proofJson: jsonb('proof_json'),
  detectedAt: timestamp('detected_at', { withTimezone: true }).notNull(),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
}, (table) => ({
  sourceEventUnique: uniqueIndex('trigger_events_source_event_unique').on(table.sourceChain, table.sourceTransactionHash, table.logIndex),
}));

export const workerCursors = pgTable('worker_cursors', {
  name: text('name').primaryKey(),
  blockNumber: bigint('block_number', { mode: 'bigint' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const proposedActions = pgTable('proposed_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategyId: uuid('strategy_id').notNull().references(() => strategies.id),
  triggerEventId: uuid('trigger_event_id').notNull().references(() => triggerEvents.id),
  actionJson: jsonb('action_json').notNull(),
  simulationJson: jsonb('simulation_json'),
  status: text('status').notNull(),
  requiresApproval: boolean('requires_approval').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
});

export const executions = pgTable('executions', {
  id: uuid('id').primaryKey().defaultRandom(),
  proposedActionId: uuid('proposed_action_id').notNull().references(() => proposedActions.id),
  creditcoinTransactionHash: text('creditcoin_transaction_hash'),
  initiatedBy: text('initiated_by').notNull(),
  mcpClientName: text('mcp_client_name'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
