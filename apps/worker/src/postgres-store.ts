import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { z } from 'zod';
import { isAllowedTriggerTransition, type CoordinationStore, type TriggerInput, type TriggerRecord, type TriggerStatus } from '@affest/database';

const statusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('detected'), detectedAt: z.coerce.date() }),
  z.object({ kind: z.literal('source-confirmed'), confirmedAt: z.coerce.date() }),
  z.object({ kind: z.literal('waiting-for-attestation'), nextAttemptAt: z.coerce.date() }),
  z.object({ kind: z.literal('proof-ready'), proofReference: z.string(), verifiedAt: z.coerce.date() }),
  z.object({ kind: z.literal('verified'), verifiedAt: z.coerce.date(), transactionHash: z.string() }),
  z.object({ kind: z.literal('approval-pending'), eventKey: z.string(), requestTransactionHash: z.string(), expiresAt: z.coerce.date() }),
  z.object({ kind: z.literal('executed'), executedAt: z.coerce.date(), transactionHash: z.string() }),
  z.object({ kind: z.literal('failed'), reason: z.string(), retryable: z.boolean() }),
  z.object({ kind: z.literal('rejected'), reason: z.string() }),
]);

function serializeStatus(status: TriggerStatus): Record<string, unknown> {
  switch (status.kind) {
    case 'detected': return { kind: status.kind, detectedAt: status.detectedAt.toISOString() };
    case 'source-confirmed': return { kind: status.kind, confirmedAt: status.confirmedAt.toISOString() };
    case 'waiting-for-attestation': return { kind: status.kind, nextAttemptAt: status.nextAttemptAt.toISOString() };
    case 'proof-ready': return { kind: status.kind, proofReference: status.proofReference, verifiedAt: status.verifiedAt.toISOString() };
    case 'verified': return { kind: status.kind, verifiedAt: status.verifiedAt.toISOString(), transactionHash: status.transactionHash };
    case 'approval-pending': return { kind: status.kind, eventKey: status.eventKey, requestTransactionHash: status.requestTransactionHash, expiresAt: status.expiresAt.toISOString() };
    case 'executed': return { kind: status.kind, executedAt: status.executedAt.toISOString(), transactionHash: status.transactionHash };
    case 'failed': return status;
    case 'rejected': return status;
    default: { const exhaustive: never = status; return exhaustive; }
  }
}

function deserializeStatus(payload: unknown): TriggerStatus {
  const result = statusSchema.safeParse(payload);
  if (!result.success) throw new Error('persisted worker trigger status is malformed');
  return result.data;
}

type TriggerRow = {
  id: string;
  strategy_id: string;
  owner_wallet: string | null;
  source_chain: string;
  source_transaction_hash: string;
  log_index: number;
  status_payload: unknown;
};

export class PostgresWorkerStore implements CoordinationStore {
  private readonly pool: Pool;
  private readonly initialized: Promise<void>;

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 4 });
    this.initialized = this.pool.query(`
      CREATE TABLE IF NOT EXISTS affest_worker_triggers (
        id text PRIMARY KEY,
        strategy_id text NOT NULL,
        owner_wallet text,
        source_chain text NOT NULL,
        source_transaction_hash text NOT NULL,
        log_index integer NOT NULL,
        status text NOT NULL,
        status_payload jsonb NOT NULL,
        event_key text,
        request_transaction_hash text,
        proof_json jsonb,
        detected_at timestamptz NOT NULL,
        verified_at timestamptz,
        UNIQUE (source_chain, source_transaction_hash, log_index)
      );
      ALTER TABLE affest_worker_triggers ADD COLUMN IF NOT EXISTS event_key text;
      ALTER TABLE affest_worker_triggers ADD COLUMN IF NOT EXISTS request_transaction_hash text;
      CREATE TABLE IF NOT EXISTS affest_worker_cursors (
        name text PRIMARY KEY,
        block_number numeric NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `).then(() => undefined);
  }

  public async upsertTrigger(input: TriggerInput): Promise<TriggerRecord> {
    await this.initialized;
    const existing = await this.pool.query<TriggerRow>(
      'SELECT id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status_payload FROM affest_worker_triggers WHERE source_chain = $1 AND source_transaction_hash = $2 AND log_index = $3 LIMIT 1',
      [input.sourceChain, input.transactionHash, input.logIndex],
    );
    if (existing.rows[0]) return this.toRecord(existing.rows[0]);
    const detectedAt = new Date();
    const detected: TriggerStatus = { kind: 'detected', detectedAt };
    const inserted = await this.pool.query<TriggerRow>(
      `INSERT INTO affest_worker_triggers (id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status, status_payload, detected_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (source_chain, source_transaction_hash, log_index) DO NOTHING
       RETURNING id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status_payload`,
      [randomUUID(), input.strategyId, input.ownerWallet ?? null, input.sourceChain, input.transactionHash, input.logIndex, detected.kind, serializeStatus(detected), detectedAt],
    );
    if (inserted.rows[0]) return this.toRecord(inserted.rows[0]);
    const raced = await this.pool.query<TriggerRow>(
      'SELECT id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status_payload FROM affest_worker_triggers WHERE source_chain = $1 AND source_transaction_hash = $2 AND log_index = $3 LIMIT 1',
      [input.sourceChain, input.transactionHash, input.logIndex],
    );
    if (!raced.rows[0]) throw new Error('worker trigger insert race did not return a row');
    return this.toRecord(raced.rows[0]);
  }

  public async getTrigger(id: string): Promise<TriggerRecord | undefined> {
    await this.initialized;
    const result = await this.pool.query<TriggerRow>('SELECT id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status_payload FROM affest_worker_triggers WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0] ? this.toRecord(result.rows[0]) : undefined;
  }

  public async listTriggers(): Promise<readonly TriggerRecord[]> {
    await this.initialized;
    const result = await this.pool.query<TriggerRow>('SELECT id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status_payload FROM affest_worker_triggers ORDER BY detected_at DESC');
    return result.rows.map((row) => this.toRecord(row));
  }

  public async transitionTrigger(id: string, status: TriggerStatus): Promise<TriggerRecord> {
    const current = await this.getTrigger(id);
    if (!current) throw new Error('worker trigger not found');
    if (!isAllowedTriggerTransition(current.status.kind, status.kind)) throw new Error(`invalid trigger transition: ${current.status.kind} -> ${status.kind}`);
    await this.pool.query(
      'UPDATE affest_worker_triggers SET status = $2, status_payload = $3, verified_at = $4, event_key = $5, request_transaction_hash = $6 WHERE id = $1',
      [id, status.kind, serializeStatus(status), status.kind === 'verified' ? status.verifiedAt : null, status.kind === 'approval-pending' ? status.eventKey : null, status.kind === 'approval-pending' ? status.requestTransactionHash : null],
    );
    const updated = await this.getTrigger(id);
    if (!updated) throw new Error('worker trigger disappeared after update');
    return updated;
  }

  public async saveProof(triggerId: string, proof: unknown): Promise<void> {
    await this.initialized;
    await this.pool.query('UPDATE affest_worker_triggers SET proof_json = $2 WHERE id = $1', [triggerId, proof]);
  }

  public async getProof(triggerId: string): Promise<unknown | undefined> {
    await this.initialized;
    const result = await this.pool.query<{ proof_json: unknown }>('SELECT proof_json FROM affest_worker_triggers WHERE id = $1 LIMIT 1', [triggerId]);
    return result.rows[0]?.proof_json;
  }

  public async getCursor(name: string): Promise<bigint | undefined> {
    await this.initialized;
    const result = await this.pool.query<{ block_number: string }>('SELECT block_number FROM affest_worker_cursors WHERE name = $1 LIMIT 1', [name]);
    return result.rows[0] ? BigInt(result.rows[0].block_number) : undefined;
  }

  public async setCursor(name: string, block: bigint): Promise<void> {
    await this.initialized;
    await this.pool.query('INSERT INTO affest_worker_cursors (name, block_number) VALUES ($1, $2) ON CONFLICT (name) DO UPDATE SET block_number = EXCLUDED.block_number, updated_at = now()', [name, block.toString()]);
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  private toRecord(row: TriggerRow): TriggerRecord {
    return {
      id: row.id,
      strategyId: row.strategy_id,
      sourceChain: row.source_chain,
      transactionHash: row.source_transaction_hash,
      logIndex: row.log_index,
      ...(row.owner_wallet ? { ownerWallet: row.owner_wallet } : {}),
      status: deserializeStatus(row.status_payload),
    };
  }
}
