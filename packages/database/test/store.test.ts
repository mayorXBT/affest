import { describe, expect, it } from 'vitest';
import { MemoryCoordinationStore } from '../src/index.js';

describe('MemoryCoordinationStore', () => {
  it('deduplicates a source event by chain, transaction and log index', async () => {
    const store = new MemoryCoordinationStore();
    const input = { strategyId: 'strategy-1', sourceChain: 'ethereum-sepolia', transactionHash: `0x${'11'.repeat(32)}`, logIndex: 2 } as const;
    const first = await store.upsertTrigger(input);
    const second = await store.upsertTrigger(input);
    expect(second.id).toBe(first.id);
    expect((await store.listTriggers())).toHaveLength(1);
  });

  it('allows only ordered trigger lifecycle transitions', async () => {
    const store = new MemoryCoordinationStore();
    const trigger = await store.upsertTrigger({ strategyId: 'strategy-1', sourceChain: 'ethereum-sepolia', transactionHash: `0x${'22'.repeat(32)}`, logIndex: 0 });
    await store.transitionTrigger(trigger.id, { kind: 'source-confirmed', confirmedAt: new Date() });
    await store.transitionTrigger(trigger.id, { kind: 'waiting-for-attestation', nextAttemptAt: new Date() });
    await store.transitionTrigger(trigger.id, { kind: 'proof-ready', proofReference: 'proof-1', verifiedAt: new Date() });
    const updated = await store.getTrigger(trigger.id);
    expect(updated?.status.kind).toBe('proof-ready');
    await expect(store.transitionTrigger(trigger.id, { kind: 'detected', detectedAt: new Date() })).rejects.toThrow('invalid trigger transition');
  });
});
