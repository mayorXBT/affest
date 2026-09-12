import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { rebalancePreflight, type LiveVaultBalances } from '../src/live.js';

const vault = getAddress('0x0000000000000000000000000000000000000001');
const stable = getAddress('0x0000000000000000000000000000000000000011');
const risk = getAddress('0x0000000000000000000000000000000000000022');

function balances(stableBalance: string, riskBalance: string, readable = true): LiveVaultBalances {
  return {
    vault,
    owner: vault,
    nativeTctc: '0',
    stable: { asset: stable, symbol: 'WTCTC', decimals: 18, balance: stableBalance, readable },
    risk: { asset: risk, symbol: readable ? 'DEMO_RISK' : null, decimals: readable ? 18 : null, balance: riskBalance, readable, ...(readable ? {} : { reason: 'Risk asset has no contract code on Creditcoin CC3.' }) },
  };
}

describe('rebalance preflight', () => {
  it('returns the deposit guidance when both vault assets are zero', () => {
    const result = rebalancePreflight(balances('0', '0'), 7000);
    expect(result).toEqual({
      possible: false,
      reason: 'Vault has no assets. Deposit testnet TCTC/ETH before rebalancing.',
      nextAction: 'Deposit supported CC3 vault assets, then refresh the portfolio.',
    });
  });

  it('identifies a source-chain token mistakenly used as a CC3 risk asset', () => {
    const result = rebalancePreflight(balances('1000000000000000000000', '0', false), 8000);
    expect(result.possible).toBe(false);
    expect(result.reason).toContain('no contract code on Creditcoin CC3');
    expect(result.nextAction).toContain('recreate any strategy');
  });

  it('calculates the amount and direction for a funded valid vault', () => {
    const result = rebalancePreflight(balances('1000', '0'), 7000);
    expect(result).toMatchObject({ possible: true, amountIn: '300', direction: 'stable-to-risk' });
  });
});
