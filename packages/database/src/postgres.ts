import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema.js';
import { triggerEvents, workerCursors } from './schema.js';
import {
  type CoordinationStore,
  type TriggerInput,
  type TriggerRecord,
  type TriggerStatus,
  isAllowedTriggerTransition,
} from './index.js';
import { z } from 'zod';

export type AffestDatabase = NodePgDatabase<typeof schema>;

const statusSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('detected'), detectedAt: z.coerce.date() }),
  z.object({ kind: z.literal('source-confirmed'), confirmedAt: z.coerce.date() }),
  z.object({ kind: z.literal('waiting-for-attestation'), nextAttemptAt: z.coerce.date() }),
  z.object({ kind: z.literal('proof-ready'), proofReference: z.string(), verifiedAt: z.coerce.date() }),
  z.object({ kind: z.literal('verified'), verifiedAt: z.coerce.date(), transactionHash: z.string() }),
  z.object({ kind: z.literal('approval-pending'), expiresAt: z.coerce.date() }),
  z.object({ kind: z.literal('executed'), executedAt: z.coerce.date(), transactionHash: z.string().default('') }),
  z.object({ kind: z.literal('failed'), reason: z.string(), retryable: z.boolean() }),
  z.object({ kind: z.literal('rejected'), reason: z.string() }),
]);

function serializeStatus(status: TriggerStatus): unknown {
  switch (status.kind) {
    case 'detected': return { kind: status.kind, detectedAt: status.detectedAt.toISOString() };
    case 'source-confirmed': return { kind: status.kind, confirmedAt: status.confirmedAt.toISOString() };
    case 'waiting-for-attestation': return { kind: status.kind, nextAttemptAt: status.nextAttemptAt.toISOString() };
    case 'proof-ready': return { kind: status.kind, proofReference: status.proofReference, verifiedAt: status.verifiedAt.toISOString() };
    case 'verified': return { kind: status.kind, verifiedAt: status.verifiedAt.toISOString(), transactionHash: status.transactionHash };
    case 'approval-pending': return { kind: status.kind, expiresAt: status.expiresAt.toISOString() };
    case 'executed': return { kind: status.kind, executedAt: status.executedAt.toISOString(), transactionHash: status.transactionHash };
    case 'failed': return status;
    case 'rejected': return status;
    default: { const exhaustive: never = status; return exhaustive; }
  }
}

function deserializeStatus(payload: unknown): TriggerStatus {
  const result = statusSchema.safeParse(payload);
  if (!result.success) throw new Error('persisted trigger status is malformed');
  return result.data;
}

export class PostgresCoordinationStore implements CoordinationStore {
  public constructor(private readonly db: AffestDatabase) {}

  public async upsertTrigger(input: TriggerInput): Promise<TriggerRecord> {
    const existing = await this.db.select().from(triggerEvents).where(and(
      eq(triggerEvents.sourceChain, input.sourceChain),
      eq(triggerEvents.sourceTransactionHash, input.transactionHash),
      eq(triggerEvents.logIndex, input.logIndex),
    )).limit(1);
    const current = existing[0];
    if (current) return this.toRecord(current);
    const status: TriggerStatus = { kind: 'detected', detectedAt: new Date() };
    const inserted = await this.db.insert(triggerEvents).values({
      strategyId: input.strategyId,
      sourceChain: input.sourceChain,
      sourceTransactionHash: input.transactionHash,
      logIndex: input.logIndex,
      status: status.kind,
      statusPayload: serializeStatus(status),
      attestationStatus: status.kind,
      detectedAt: status.detectedAt,
    }).onConflictDoNothing({
      target: [triggerEvents.sourceChain, triggerEvents.sourceTransactionHash, triggerEvents.logIndex],
    }).returning();
    const row = inserted[0];
    if (row) return this.toRecord(row);

    // Another worker won the insert race. Read its canonical row so callers
    // receive the same id and status instead of a transient uniqueness error.
    const raced = await this.db.select().from(triggerEvents).where(and(
      eq(triggerEvents.sourceChain, input.sourceChain),
      eq(triggerEvents.sourceTransactionHash, input.transactionHash),
      eq(triggerEvents.logIndex, input.logIndex),
    )).limit(1);
    const racedRow = raced[0];
    if (!racedRow) throw new Error('database did not return inserted trigger');
    return this.toRecord(racedRow);
  }

  public async getTrigger(id: string): Promise<TriggerRecord | undefined> {
    const rows = await this.db.select().from(triggerEvents).where(eq(triggerEvents.id, id)).limit(1);
    const row = rows[0];
    return row ? this.toRecord(row) : undefined;
  }

  public async listTriggers(): Promise<readonly TriggerRecord[]> {
    const rows = await this.db.select().from(triggerEvents);
    return rows.map((row) => this.toRecord(row));
  }

  public async transitionTrigger(id: string, status: TriggerStatus): Promise<TriggerRecord> {
    const current = await this.getTrigger(id);
    if (!current) throw new Error('trigger not found');
    if (!isAllowedTriggerTransition(current.status.kind, status.kind)) {
      throw new Error(`invalid trigger transition: ${current.status.kind} -> ${status.kind}`);
    }
    const updated = await this.db.update(triggerEvents).set({
      status: status.kind,
      statusPayload: serializeStatus(status),
      attestationStatus: status.kind,
      proofReference: status.kind === 'proof-ready' ? status.proofReference : undefined,
      verifiedAt: status.kind === 'verified' ? status.verifiedAt : undefined,
    }).where(eq(triggerEvents.id, id)).returning();
    const row = updated[0];
    if (!row) throw new Error('database did not return updated trigger');
    return this.toRecord(row);
  }

  public async saveProof(triggerId: string, proof: unknown): Promise<void> {
    await this.db.update(triggerEvents).set({ proofJson: proof }).where(eq(triggerEvents.id, triggerId));
  }

  public async getProof(triggerId: string): Promise<unknown | undefined> {
    const rows = await this.db.select({ proof: triggerEvents.proofJson }).from(triggerEvents).where(eq(triggerEvents.id, triggerId)).limit(1);
    return rows[0]?.proof ?? undefined;
  }

  public async getCursor(name: string): Promise<bigint | undefined> {
    const rows = await this.db.select().from(workerCursors).where(eq(workerCursors.name, name)).limit(1);
    return rows[0]?.blockNumber;
  }

  public async setCursor(name: string, block: bigint): Promise<void> {
    await this.db.insert(workerCursors).values({ name, blockNumber: block }).onConflictDoUpdate({ target: workerCursors.name, set: { blockNumber: block, updatedAt: new Date() } });
  }

  private toRecord(row: typeof triggerEvents.$inferSelect): TriggerRecord {
    return {
      id: row.id,
      strategyId: row.strategyId,
      sourceChain: row.sourceChain,
      transactionHash: row.sourceTransactionHash,
      logIndex: row.logIndex,
      status: deserializeStatus(row.statusPayload),
    };
  }
}
