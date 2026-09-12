import { describe, expect, it } from 'vitest';
import { MemoryCoordinationStore } from '@affest/database';
import { AttestationWorker, type SourceChainPort, type AttestationPort, type CreditcoinPort, type WorkerLogger } from '../src/index.js';

const proof = {
  chainKey: 1,
  headerNumber: 123,
  txIndex: 0,
  txHash: `0x${'11'.repeat(32)}`,
  txBytes: '0x1234',
  continuityProof: { lowerEndpointDigest: `0x${'22'.repeat(32)}`, roots: [`0x${'33'.repeat(32)}`] },
  merkleProof: { root: `0x${'44'.repeat(32)}`, siblings: [] },
  cached: false,
  generatedAt: '2026-09-08T00:00:00.000Z',
};

function ports(overrides: Partial<SourceChainPort & AttestationPort & CreditcoinPort> = {}) {
  const source: SourceChainPort = {
    async latestBlock() { return 123n; },
    async listSignals() { return [{ strategyId: 'strategy-1', transactionHash: `0x${'11'.repeat(32)}`, logIndex: 0 }]; },
    async getReceipt() { return { status: 'success', blockNumber: 123 }; },
  };
  const attestation: AttestationPort = {
    async getAttestedHeight() { return 123; },
    async buildProof() { return proof; },
  };
  const creditcoin: CreditcoinPort = {
    async listActiveStrategies() { return [{ strategyId: 'strategy-1', owner: '0x0000000000000000000000000000000000000001', triggerAsset: '0x0000000000000000000000000000000000000011', minimumTriggerAmount: '1', signalType: 1 }]; },
    async simulateProof() { return { ok: true as const }; },
    async submitProof() { return { transactionHash: `0x${'aa'.repeat(32)}`, eventKey: `0x${'bb'.repeat(32)}`, automatic: true }; },
  };
  return { source: { ...source, ...overrides }, attestation: { ...attestation, ...overrides }, creditcoin: { ...creditcoin, ...overrides } };
}

describe('AttestationWorker', () => {
  it('is idempotent for duplicate source logs and completes a verified proof flow', async () => {
    const store = new MemoryCoordinationStore();
    const worker = new AttestationWorker(store, ports());
    await worker.runOnce();
    await worker.runOnce();
    const triggers = await store.listTriggers();
    expect(triggers).toHaveLength(1);
    expect(triggers[0]?.status.kind).toBe('executed');
  });

  it('routes a source signal to every matching active strategy without an environment strategy id', async () => {
    const store = new MemoryCoordinationStore();
    const worker = new AttestationWorker(store, ports({
      async listSignals() {
        return [{
          transactionHash: `0x${'12'.repeat(32)}`,
          logIndex: 0,
          user: '0x0000000000000000000000000000000000000001',
          asset: '0x0000000000000000000000000000000000000011',
          amount: '100',
          signalType: 1,
        }];
      },
      async listActiveStrategies() {
        return [
          { strategyId: 'strategy-1', owner: '0x0000000000000000000000000000000000000001', triggerAsset: '0x0000000000000000000000000000000000000011', minimumTriggerAmount: '1', signalType: 1 },
          { strategyId: 'strategy-2', owner: '0x0000000000000000000000000000000000000001', triggerAsset: '0x0000000000000000000000000000000000000011', minimumTriggerAmount: '50', signalType: 1 },
        ];
      },
    }));
    await worker.runOnce();
    const triggers = await store.listTriggers();
    expect(triggers).toHaveLength(2);
    expect(triggers.map((trigger) => trigger.strategyId).sort()).toEqual(['strategy-1', 'strategy-2']);
  });

  it('persists approval-pending for approval mode or an over-limit hybrid action', async () => {
    const store = new MemoryCoordinationStore();
    const worker = new AttestationWorker(store, ports({
      async submitProof() {
        return {
          transactionHash: `0x${'aa'.repeat(32)}`,
          eventKey: `0x${'bb'.repeat(32)}`,
          automatic: false,
        };
      },
    }));
    await worker.runOnce();
    const status = (await store.listTriggers())[0]?.status;
    expect(status?.kind).toBe('approval-pending');
    if (status?.kind === 'approval-pending') {
      expect(status.eventKey).toBe(`0x${'bb'.repeat(32)}`);
      expect(status.requestTransactionHash).toBe(`0x${'aa'.repeat(32)}`);
    }
  });

  it('waits when the source block is not attested yet', async () => {
    const store = new MemoryCoordinationStore();
    let attestedHeight = 122;
    const worker = new AttestationWorker(store, ports({ async getAttestedHeight() { return attestedHeight; } }));
    await worker.runOnce();
    expect((await store.listTriggers())[0]?.status.kind).toBe('waiting-for-attestation');
    await worker.runOnce();
    expect((await store.listTriggers())[0]?.status.kind).toBe('waiting-for-attestation');
    attestedHeight = 123;
    await worker.runOnce();
    expect((await store.listTriggers())[0]?.status.kind).toBe('executed');
  });

  it('rejects a reverted source transaction without requesting a proof', async () => {
    const store = new MemoryCoordinationStore();
    let proofCalls = 0;
    const worker = new AttestationWorker(store, ports({
      async getReceipt() { return { status: 'reverted', blockNumber: 123 }; },
      async buildProof() { proofCalls++; return proof; },
    }));
    await worker.runOnce();
    expect((await store.listTriggers())[0]?.status.kind).toBe('rejected');
    expect(proofCalls).toBe(0);
  });

  it('reports healthy completion and emits redacted structured events', async () => {
    const store = new MemoryCoordinationStore();
    const events: string[] = [];
    const logger: WorkerLogger = {
      info(event) { events.push(event); },
      warn(event) { events.push(event); },
      error(event) { events.push(event); },
    };
    const worker = new AttestationWorker(store, ports(), 1, 'test-cursor', 0n, logger);
    await worker.runOnce();
    expect(worker.health().status).toBe('idle');
    expect(worker.health().processedTriggers).toBe(1);
    expect(events).toContain('trigger.verified');
  });
});
