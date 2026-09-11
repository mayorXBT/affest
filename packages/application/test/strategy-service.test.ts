import { describe, expect, it } from 'vitest';
import { StrategyApplicationService } from '../src/index.js';

const draft = {
  sourceChain: 'ethereum-sepolia',
  trigger: { type: 'TOKEN_RECEIVED', asset: 'ETH', minimumAmount: '1000' },
  targetAllocation: [{ asset: 'TCTC', weightBps: 7000 }, { asset: 'ETH', weightBps: 3000 }],
  executionMode: 'HYBRID',
  automaticExecutionLimit: '500',
  maximumActionAmount: '500',
  maximumWeeklyAmount: '1500',
  maximumSlippageBps: 50,
  expiresAt: 1_900_000_000,
};

describe('StrategyApplicationService', () => {
  it('returns a validated draft and never exposes provider output as executable permission', async () => {
    const service = new StrategyApplicationService({ async draftStrategy() { return draft; } });
    const result = await service.draft('keep a stable portfolio');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.requiresUserApproval).toBe(true);
  });

  it('returns a structured rejection for unsafe provider output', async () => {
    const service = new StrategyApplicationService({ async draftStrategy() { return { ...draft, targetAllocation: [{ asset: 'UNKNOWN', weightBps: 10000 }, { asset: 'ETH', weightBps: 0 }] }; } });
    const result = await service.draft('do anything');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('invalid-draft');
  });
});
