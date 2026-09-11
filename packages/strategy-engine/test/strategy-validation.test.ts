import { describe, expect, it } from 'vitest';
import { validateStrategy } from '../src/index.js';

const valid = {
  sourceChain: 'ethereum-sepolia',
  trigger: { type: 'TOKEN_RECEIVED', asset: 'ETH', minimumAmount: '1000' },
  targetAllocation: [
    { asset: 'TCTC', weightBps: 7000 },
    { asset: 'ETH', weightBps: 3000 },
  ],
  executionMode: 'HYBRID',
  automaticExecutionLimit: '500',
  maximumActionAmount: '500',
  maximumWeeklyAmount: '1500',
  maximumSlippageBps: 50,
  expiresAt: 1_900_000_000,
};

describe('validateStrategy', () => {
  it('accepts a deterministic supported hybrid policy', () => {
    const result = validateStrategy(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.targetAllocation[0]).toEqual({ asset: 'TCTC', weightBps: 7000 });
  });

  it('rejects allocations that do not total ten thousand basis points', () => {
    const result = validateStrategy({ ...valid, targetAllocation: [...valid.targetAllocation.slice(0, 1), { asset: 'ETH', weightBps: 2999 }] });
    expect(result.ok).toBe(false);
  });

  it('rejects automatic execution without a finite positive limit and expiry', () => {
    const result = validateStrategy({ ...valid, executionMode: 'AUTOMATIC', automaticExecutionLimit: '0', expiresAt: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects unsupported assets and malformed integer units', () => {
    const result = validateStrategy({ ...valid, trigger: { ...valid.trigger, asset: 'UNKNOWN' }, maximumActionAmount: '-1' });
    expect(result.ok).toBe(false);
  });
});
