import type { Address } from 'viem';
import { sepoliaContracts } from '@/lib/contracts';

/** User-facing label for the strategy's second sleeve/trigger family. */
export function strategyRiskLabel(triggerAsset: Address): 'ETH' | 'TCTC' {
  return triggerAsset.toLowerCase() === sepoliaContracts.weth.toLowerCase() ? 'ETH' : 'TCTC';
}
