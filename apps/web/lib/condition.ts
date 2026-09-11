import { type AffestAssetId } from '@/lib/assets';

export const metricFns = ['price', 'mcap', 'volume', 'sma', 'ema'] as const;
export type MetricFn = (typeof metricFns)[number];
export type FnId = MetricFn | 'fixed';
export type Comparator = 'greater' | 'less';

export type ConditionSide =
  | { kind: 'empty' }
  | { kind: 'metric'; fn: MetricFn; asset: AffestAssetId }
  | { kind: 'fixed'; value: string };

export type Condition = {
  left: ConditionSide;
  comparator: Comparator;
  right: ConditionSide;
};

export type IfElseBlock = {
  condition: Condition;
  thenAssets: AffestAssetId[];
  elseAssets: AffestAssetId[];
};

export type SpotSnapshot = {
  ethUsd: number;
  ctcUsd: number;
  ethMcap: number;
  ctcMcap: number;
  ethVolume: number;
  ctcVolume: number;
  ethSpark: number[];
  ctcSpark: number[];
};

export const fnLabels: Record<FnId, string> = {
  price: 'Current Price',
  mcap: 'Current Market Cap',
  volume: 'Volume',
  sma: 'Simple Moving Average',
  ema: 'Exponential Moving Average',
  fixed: 'Fixed Value',
};

export const fnOptions: { id: FnId; label: string }[] = [
  { id: 'price', label: fnLabels.price },
  { id: 'mcap', label: fnLabels.mcap },
  { id: 'fixed', label: fnLabels.fixed },
  { id: 'volume', label: fnLabels.volume },
  { id: 'sma', label: fnLabels.sma },
  { id: 'ema', label: fnLabels.ema },
];

export const comparatorOptions: { id: Comparator; label: string }[] = [
  { id: 'greater', label: 'greater' },
  { id: 'less', label: 'less' },
];

export function emptyCondition(): Condition {
  return { left: { kind: 'empty' }, comparator: 'greater', right: { kind: 'empty' } };
}

export function defaultIfElse(): IfElseBlock {
  return {
    condition: emptyCondition(),
    thenAssets: [],
    elseAssets: [],
  };
}

export function mixFromAssets(assets: AffestAssetId[]): { TCTC: number; ETH: number } {
  const hasTctc = assets.includes('TCTC');
  const hasEth = assets.includes('ETH');
  if (hasTctc && hasEth) return { TCTC: 50, ETH: 50 };
  if (hasTctc) return { TCTC: 100, ETH: 0 };
  if (hasEth) return { TCTC: 0, ETH: 100 };
  return { TCTC: 0, ETH: 0 };
}

export function storedTctcPct(assets: AffestAssetId[]): number {
  const mix = mixFromAssets(assets);
  if (mix.TCTC === 100) return 90;
  if (mix.ETH === 100) return 10;
  return mix.TCTC;
}

export function sideFromFn(fn: FnId, fallbackAsset: AffestAssetId, previous: ConditionSide): ConditionSide {
  if (fn === 'fixed') {
    return { kind: 'fixed', value: previous.kind === 'fixed' ? previous.value : '' };
  }
  return {
    kind: 'metric',
    fn,
    asset: previous.kind === 'metric' ? previous.asset : fallbackAsset,
  };
}

export function isCompleteSide(side: ConditionSide): boolean {
  if (side.kind === 'empty') return false;
  if (side.kind === 'fixed') {
    if (side.value.trim() === '') return false;
    return Number.isFinite(Number(side.value));
  }
  return true;
}

export function isCompleteCondition(condition: Condition): boolean {
  return isCompleteSide(condition.left) && isCompleteSide(condition.right);
}

function mean(values: number[]): number | undefined {
  if (values.length < 2) return undefined;
  const slice = values.slice(-24);
  const total = slice.reduce((sum, value) => sum + value, 0);
  return total / slice.length;
}

function ema(values: number[]): number | undefined {
  const first = values[0];
  if (first === undefined || values.length < 2) return undefined;
  const period = Math.min(values.length, 24);
  const k = 2 / (period + 1);
  let current = first;
  for (const value of values.slice(1)) {
    current = value * k + current * (1 - k);
  }
  return current;
}

function metricValue(fn: MetricFn, asset: AffestAssetId, prices: SpotSnapshot): number | undefined {
  const spark = asset === 'ETH' ? prices.ethSpark : prices.ctcSpark;
  switch (fn) {
    case 'price': {
      const value = asset === 'ETH' ? prices.ethUsd : prices.ctcUsd;
      return value > 0 ? value : undefined;
    }
    case 'mcap': {
      const value = asset === 'ETH' ? prices.ethMcap : prices.ctcMcap;
      return value > 0 ? value : undefined;
    }
    case 'volume': {
      const value = asset === 'ETH' ? prices.ethVolume : prices.ctcVolume;
      return value > 0 ? value : undefined;
    }
    case 'sma':
      return mean(spark);
    case 'ema':
      return ema(spark);
    default: {
      const _exhaustive: never = fn;
      return _exhaustive;
    }
  }
}

function sideValue(side: ConditionSide, prices: SpotSnapshot): number | undefined {
  if (side.kind === 'empty') return undefined;
  if (side.kind === 'fixed') {
    if (side.value.trim() === '') return undefined;
    const value = Number(side.value);
    return Number.isFinite(value) ? value : undefined;
  }
  return metricValue(side.fn, side.asset, prices);
}

export function conditionHolds(condition: Condition, prices: SpotSnapshot | undefined): boolean | undefined {
  if (!prices || !isCompleteCondition(condition)) return undefined;
  const left = sideValue(condition.left, prices);
  const right = sideValue(condition.right, prices);
  if (left === undefined || right === undefined) return undefined;
  return condition.comparator === 'greater' ? left > right : left < right;
}

export function formatSide(side: ConditionSide): string {
  if (side.kind === 'empty') return 'this';
  if (side.kind === 'fixed') return side.value.trim() === '' ? 'a fixed value' : side.value;
  return `${fnLabels[side.fn]} of ${side.asset}`;
}

export function formatCondition(condition: Condition): string {
  if (!isCompleteCondition(condition)) return 'this happens';
  return `${formatSide(condition.left)} is ${condition.comparator} than ${formatSide(condition.right)}`;
}

export function formatConditionChip(condition: Condition): string {
  if (!isCompleteCondition(condition)) return 'Set Condition';
  return `If ${formatCondition(condition)}`;
}

export function triggerAsset(block: IfElseBlock): AffestAssetId {
  if (block.condition.left.kind === 'metric') return block.condition.left.asset;
  return block.thenAssets[0] ?? 'ETH';
}

export function branchLabel(assets: AffestAssetId[]): string {
  if (assets.length === 0) return 'nothing';
  return assets.join(' + ');
}
