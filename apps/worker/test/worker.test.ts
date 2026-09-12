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
    const worker = new AttestationWorker(store, ports({ async getAttestedHeight() { return 122; } }));
    await worker.runOnce();
    expect((await store.listTriggers())[0]?.status.kind).toBe('waiting-for-attestation');
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
