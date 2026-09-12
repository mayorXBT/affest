export * from './schema.js';

export type TriggerStatus =
  | { readonly kind: 'detected'; readonly detectedAt: Date }
  | { readonly kind: 'source-confirmed'; readonly confirmedAt: Date }
  | { readonly kind: 'waiting-for-attestation'; readonly nextAttemptAt: Date }
  | { readonly kind: 'proof-ready'; readonly proofReference: string; readonly verifiedAt: Date }
  | { readonly kind: 'verified'; readonly verifiedAt: Date; readonly transactionHash: string }
  | { readonly kind: 'approval-pending'; readonly eventKey: string; readonly requestTransactionHash: string; readonly expiresAt: Date }
  | { readonly kind: 'executed'; readonly executedAt: Date; readonly transactionHash: string }
  | { readonly kind: 'failed'; readonly reason: string; readonly retryable: boolean }
  | { readonly kind: 'rejected'; readonly reason: string };

export type TriggerRecord = {
  readonly id: string;
  readonly strategyId: string;
  readonly sourceChain: string;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly ownerWallet?: string;
  readonly status: TriggerStatus;
};

export type TriggerInput = {
  readonly strategyId: string;
  readonly sourceChain: string;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly ownerWallet?: string;
};

export interface CoordinationStore {
  upsertTrigger(input: TriggerInput): Promise<TriggerRecord>;
  getTrigger(id: string): Promise<TriggerRecord | undefined>;
  listTriggers(): Promise<readonly TriggerRecord[]>;
  transitionTrigger(id: string, status: TriggerStatus): Promise<TriggerRecord>;
  saveProof(triggerId: string, proof: unknown): Promise<void>;
  getProof(triggerId: string): Promise<unknown | undefined>;
  getCursor(name: string): Promise<bigint | undefined>;
  setCursor(name: string, block: bigint): Promise<void>;
}

export type TriggerTransition = Exclude<TriggerStatus, { kind: 'detected' }> | TriggerStatus;

const allowedTransitions: Readonly<Record<TriggerStatus['kind'], readonly TriggerStatus['kind'][]>> = {
  detected: ['source-confirmed', 'failed', 'rejected'],
  'source-confirmed': ['waiting-for-attestation', 'proof-ready', 'failed', 'rejected'],
  'waiting-for-attestation': ['proof-ready', 'failed', 'rejected'],
  'proof-ready': ['verified', 'failed', 'rejected'],
  verified: ['approval-pending', 'executed', 'failed', 'rejected'],
  'approval-pending': ['executed', 'failed', 'rejected'],
  executed: [],
  failed: [],
  rejected: [],
};

export function isAllowedTriggerTransition(
  current: TriggerStatus['kind'],
  next: TriggerStatus['kind'],
): boolean {
  return allowedTransitions[current].includes(next);
}

export class MemoryCoordinationStore implements CoordinationStore {
  private readonly triggers = new Map<string, TriggerRecord>();
  private readonly proofs = new Map<string, unknown>();
  private readonly cursors = new Map<string, bigint>();
  private sequence = 0;

  async upsertTrigger(input: TriggerInput): Promise<TriggerRecord> {
    const existing = [...this.triggers.values()].find((trigger) =>
      trigger.sourceChain === input.sourceChain
      && trigger.transactionHash.toLowerCase() === input.transactionHash.toLowerCase()
      && trigger.logIndex === input.logIndex,
    );
    if (existing) return existing;
    const record: TriggerRecord = {
      ...input,
      id: `trigger-${++this.sequence}`,
      status: { kind: 'detected', detectedAt: new Date() },
    };
    this.triggers.set(record.id, record);
    return record;
  }

  async getTrigger(id: string): Promise<TriggerRecord | undefined> {
    return this.triggers.get(id);
  }

  async listTriggers(): Promise<readonly TriggerRecord[]> {
    return [...this.triggers.values()];
  }

  async transitionTrigger(id: string, status: TriggerStatus): Promise<TriggerRecord> {
    const current = this.triggers.get(id);
    if (!current) throw new Error('trigger not found');
    if (!isAllowedTriggerTransition(current.status.kind, status.kind)) {
      throw new Error(`invalid trigger transition: ${current.status.kind} -> ${status.kind}`);
    }
    const updated = { ...current, status };
    this.triggers.set(id, updated);
    return updated;
  }

  async saveProof(triggerId: string, proof: unknown): Promise<void> {
    this.proofs.set(triggerId, proof);
  }

  async getProof(triggerId: string): Promise<unknown | undefined> {
    return this.proofs.get(triggerId);
  }

  async getCursor(name: string): Promise<bigint | undefined> {
    return this.cursors.get(name);
  }

  async setCursor(name: string, block: bigint): Promise<void> {
    this.cursors.set(name, block);
  }
}
