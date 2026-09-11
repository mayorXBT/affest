import { formatUsd, usdFromAmount } from '@/lib/prices';
import { type StrategyDraft } from '@/lib/strategy-drafts';

export function mixReturn(tctcPct: number, tctcMove: number, ethMove: number): number {
  const tctcWeight = tctcPct / 100;
  return tctcWeight * tctcMove + (1 - tctcWeight) * ethMove;
}

export function sparkMove(values: readonly number[], lookback: number): number | undefined {
  if (values.length < 2) return undefined;
  const last = values[values.length - 1];
  const fromIndex = Math.max(0, values.length - 1 - lookback);
  const from = values[fromIndex];
  if (last === undefined || from === undefined || from === 0) return undefined;
  return last / from - 1;
}

export function strategyMetrics(input: {
  tctcPct: number;
  tctcHoldings: bigint;
  ethHoldings: bigint;
  ctcUsd: number;
  ethUsd: number;
  ctcSpark: readonly number[];
  ethSpark: readonly number[];
  draft?: StrategyDraft;
}): {
  currentUsd: number | undefined;
  dayReturn: number | undefined;
  totalReturn: number | undefined;
  allocated: boolean;
} {
  const tctcUsd = usdFromAmount(input.tctcHoldings, input.ctcUsd);
  const ethUsd = usdFromAmount(input.ethHoldings, input.ethUsd);
  const bagUsd = (tctcUsd ?? 0) + (ethUsd ?? 0);
  const impliedUsd = (tctcUsd ?? 0) * (input.tctcPct / 100) + (ethUsd ?? 0) * (1 - input.tctcPct / 100);
  const ctcDay = sparkMove(input.ctcSpark, 24);
  const ethDay = sparkMove(input.ethSpark, 24);
  const dayReturn = ctcDay === undefined && ethDay === undefined
    ? undefined
    : mixReturn(input.tctcPct, ctcDay ?? 0, ethDay ?? 0);
  const ctcWeek = sparkMove(input.ctcSpark, Math.max(input.ctcSpark.length - 1, 1));
  const ethWeek = sparkMove(input.ethSpark, Math.max(input.ethSpark.length - 1, 1));
  const weekReturn = ctcWeek === undefined && ethWeek === undefined
    ? undefined
    : mixReturn(input.tctcPct, ctcWeek ?? 0, ethWeek ?? 0);

  const allocated = input.draft?.allocatedUsd;
  const baseCtc = input.draft?.baselineCtcUsd;
  const baseEth = input.draft?.baselineEthUsd;
  if (allocated && allocated > 0 && baseCtc && baseCtc > 0 && baseEth && baseEth > 0) {
    const tctcWeight = (input.draft?.baselineTctcPct ?? input.tctcPct) / 100;
    const growth = tctcWeight * (input.ctcUsd / baseCtc) + (1 - tctcWeight) * (input.ethUsd / baseEth);
    const currentUsd = allocated * growth;
    return {
      currentUsd,
      dayReturn,
      totalReturn: currentUsd / allocated - 1,
      allocated: true,
    };
  }

  return {
    currentUsd: bagUsd > 0 ? impliedUsd : undefined,
    dayReturn,
    totalReturn: weekReturn,
    allocated: false,
  };
}

export function formatPct(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
}

export { formatUsd };
