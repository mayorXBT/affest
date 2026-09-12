import { parseAttestcoinProof, type AttestcoinProof } from '@affest/api-contracts';
import { type CoordinationStore, type TriggerRecord } from '@affest/database';

export type SourceSignal = {
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly user?: string;
  readonly asset?: string;
  readonly amount?: string;
  readonly signalType?: number;
  /** @deprecated Kept only for isolated legacy tests and old adapters. */
  readonly strategyId?: string;
};

export type ActiveStrategyTrigger = {
  readonly strategyId: string;
  readonly owner: string;
  readonly triggerAsset: string;
  readonly minimumTriggerAmount: string;
  readonly signalType: number;
};

export type SourceReceipt = {
  readonly status: 'success' | 'reverted';
  readonly blockNumber: number;
};

export interface SourceChainPort {
  latestBlock(): Promise<bigint>;
  listSignals(fromBlock: bigint): Promise<readonly SourceSignal[]>;
  getReceipt(transactionHash: string): Promise<SourceReceipt>;
}

export interface AttestationPort {
  getAttestedHeight(chainKey: number): Promise<number>;
  buildProof(chainKey: number, transactionHash: string): Promise<unknown>;
}

export interface CreditcoinPort {
  listActiveStrategies(): Promise<readonly ActiveStrategyTrigger[]>;
  simulateProof(input: { readonly trigger: TriggerRecord; readonly proof: AttestcoinProof }): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }>;
  submitProof(input: { readonly trigger: TriggerRecord; readonly proof: AttestcoinProof }): Promise<{
    readonly transactionHash: string;
    readonly eventKey: string;
    readonly automatic: boolean;
    readonly approvalExpiresAt?: Date;
  }>;
}

export type WorkerPorts = {
  readonly source: SourceChainPort;
  readonly attestation: AttestationPort;
  readonly creditcoin: CreditcoinPort;
};

export interface WorkerLogger {
  info(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
  warn(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
  error(event: string, fields?: Readonly<Record<string, string | number | boolean>>): void;
}

const silentLogger: WorkerLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export type WorkerHealth = {
  readonly status: 'idle' | 'running' | 'degraded';
  readonly lastRunAt?: Date;
  readonly lastError?: string;
  readonly processedTriggers: number;
};

function redactHash(value: string): string {
  return value.length <= 12 ? '[redacted]' : `${value.slice(0, 8)}…${value.slice(-4)}`;
}

export class AttestationWorker {
  private readonly chainKey: number;

  public constructor(
    private readonly store: CoordinationStore,
    private readonly ports: WorkerPorts,
    chainKey = 1,
    private readonly cursorName = 'ethereum-sepolia-signals',
    private readonly initialBlock = 0n,
    private readonly logger: WorkerLogger = silentLogger,
  ) {
    this.chainKey = chainKey;
  }

  private status: WorkerHealth['status'] = 'idle';
  private lastRunAt: Date | undefined;
  private lastError: string | undefined;
  private processedTriggers = 0;

  public health(): WorkerHealth {
    return {
      status: this.status,
      ...(this.lastRunAt ? { lastRunAt: this.lastRunAt } : {}),
      ...(this.lastError ? { lastError: this.lastError } : {}),
      processedTriggers: this.processedTriggers,
    };
  }

  public async runOnce(): Promise<void> {
    this.status = 'running';
    this.lastError = undefined;
    try {
      const latestBlock = await this.ports.source.latestBlock();
      const cursor = await this.store.getCursor(this.cursorName);
      const fromBlock = cursor === undefined ? this.initialBlock : cursor + 1n;
      const signals = fromBlock <= latestBlock
        ? await this.ports.source.listSignals(fromBlock)
        : [];
      this.logger.info('worker.scan', { fromBlock: Number(fromBlock), latestBlock: Number(latestBlock), signals: signals.length });
      const processedIds = new Set<string>();
      const activeStrategies = await this.ports.creditcoin.listActiveStrategies();
      for (const signal of signals) {
        const matchingStrategies = signal.strategyId
          ? activeStrategies.filter((strategy) => strategy.strategyId === signal.strategyId)
          : activeStrategies.filter((strategy) =>
            Boolean(signal.user && signal.asset && signal.amount && signal.signalType !== undefined)
            && strategy.owner.toLowerCase() === signal.user?.toLowerCase()
            && strategy.triggerAsset.toLowerCase() === signal.asset?.toLowerCase()
            && strategy.signalType === signal.signalType
            && BigInt(signal.amount ?? '0') >= BigInt(strategy.minimumTriggerAmount),
          );
        for (const strategy of matchingStrategies) {
          const trigger = await this.store.upsertTrigger({
            strategyId: strategy.strategyId,
            sourceChain: 'ethereum-sepolia',
            transactionHash: signal.transactionHash,
            logIndex: signal.logIndex,
            ...(signal.user ? { ownerWallet: signal.user } : { ownerWallet: strategy.owner }),
          });
          await this.processTrigger(trigger);
          processedIds.add(trigger.id);
          this.processedTriggers += 1;
        }
      }

      // Attestation is asynchronous. A trigger may be persisted as waiting
      // after the source scan has advanced, so revisit all non-terminal
      // triggers on every poll instead of relying on the source log appearing
      // again (it will not).
      const pending = (await this.store.listTriggers()).filter((trigger) => {
        if (processedIds.has(trigger.id)) return false;
        return trigger.status.kind === 'detected'
          || trigger.status.kind === 'source-confirmed'
          || trigger.status.kind === 'waiting-for-attestation'
          || trigger.status.kind === 'proof-ready';
      });
      for (const trigger of pending) {
        await this.processTrigger(trigger);
        this.processedTriggers += 1;
      }
      await this.store.setCursor(this.cursorName, latestBlock);
      this.status = 'idle';
      this.lastRunAt = new Date();
      this.logger.info('worker.run-complete', { latestBlock: Number(latestBlock), processed: signals.length });
    } catch (error: unknown) {
      this.status = 'degraded';
      this.lastRunAt = new Date();
      this.lastError = error instanceof Error ? error.message : 'worker run failed';
      this.logger.error('worker.run-failed', { reason: this.lastError });
      throw error;
    }
  }

  private async processTrigger(initial: TriggerRecord): Promise<void> {
    let trigger = initial;
    for (let step = 0; step < 5; step += 1) {
      switch (trigger.status.kind) {
        case 'detected': {
          const receipt = await this.ports.source.getReceipt(trigger.transactionHash);
          if (receipt.status === 'reverted') {
            trigger = await this.store.transitionTrigger(trigger.id, { kind: 'rejected', reason: 'source transaction reverted' });
            this.logger.warn('trigger.rejected', { triggerId: trigger.id, sourceTransaction: redactHash(trigger.transactionHash), reason: 'source transaction reverted' });
            continue;
          }
          trigger = await this.store.transitionTrigger(trigger.id, { kind: 'source-confirmed', confirmedAt: new Date() });
          continue;
        }
        case 'source-confirmed':
        case 'waiting-for-attestation': {
          const receipt = await this.ports.source.getReceipt(trigger.transactionHash);
          const attestedHeight = await this.ports.attestation.getAttestedHeight(this.chainKey);
          if (attestedHeight < receipt.blockNumber) {
            // A persisted waiting trigger is retried on every poll. Do not
            // transition it to the same state again: stores intentionally
            // reject self-transitions, and no state change is needed here.
            if (trigger.status.kind === 'source-confirmed') {
              trigger = await this.store.transitionTrigger(trigger.id, { kind: 'waiting-for-attestation', nextAttemptAt: new Date(Date.now() + 15_000) });
            }
            this.logger.info('attestation.waiting', { triggerId: trigger.id, sourceBlock: receipt.blockNumber, attestedHeight });
            return;
          }
          const rawProof = await this.ports.attestation.buildProof(this.chainKey, trigger.transactionHash);
          const parsedProof = parseAttestcoinProof(rawProof);
          if ('ok' in parsedProof) {
            trigger = await this.store.transitionTrigger(trigger.id, { kind: 'failed', reason: parsedProof.error, retryable: false });
            this.logger.error('proof.invalid', { triggerId: trigger.id, reason: parsedProof.error });
            return;
          }
          await this.store.saveProof(trigger.id, parsedProof);
          trigger = await this.store.transitionTrigger(trigger.id, { kind: 'proof-ready', proofReference: trigger.transactionHash, verifiedAt: new Date() });
          this.logger.info('proof-ready', {
            triggerId: trigger.id,
            sourceTransaction: redactHash(trigger.transactionHash),
          });
          continue;
        }
        case 'proof-ready': {
          const rawProof = await this.store.getProof(trigger.id);
          const parsedProof = parseAttestcoinProof(rawProof);
          if ('ok' in parsedProof) {
            trigger = await this.store.transitionTrigger(trigger.id, { kind: 'failed', reason: 'proof was not persisted', retryable: false });
            return;
          }
          const simulation = await this.ports.creditcoin.simulateProof({ trigger, proof: parsedProof });
          if (!simulation.ok) {
            trigger = await this.store.transitionTrigger(trigger.id, { kind: 'failed', reason: simulation.reason, retryable: false });
            return;
          }
          this.logger.info('creditcoin.submission', {
            triggerId: trigger.id,
            sourceTransaction: redactHash(trigger.transactionHash),
          });
          const submission = await this.ports.creditcoin.submitProof({ trigger, proof: parsedProof });
          trigger = await this.store.transitionTrigger(trigger.id, { kind: 'verified', verifiedAt: new Date(), transactionHash: submission.transactionHash });
          if (submission.automatic) {
            trigger = await this.store.transitionTrigger(trigger.id, { kind: 'executed', executedAt: new Date(), transactionHash: submission.transactionHash });
          } else {
            trigger = await this.store.transitionTrigger(trigger.id, {
              kind: 'approval-pending',
              eventKey: submission.eventKey,
              requestTransactionHash: submission.transactionHash,
              expiresAt: submission.approvalExpiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
            });
          }
          this.logger.info('trigger.verified', { triggerId: trigger.id, sourceTransaction: redactHash(trigger.transactionHash), destinationTransaction: redactHash(submission.transactionHash), automatic: submission.automatic });
          return;
        }
        case 'verified':
        case 'approval-pending':
        case 'executed':
        case 'failed':
        case 'rejected':
          return;
        default: {
          const exhaustive: never = trigger.status;
          return exhaustive;
        }
      }
    }
  }
}

export { SdkAttestationPort, ViemSepoliaSourcePort } from './adapters.js';
