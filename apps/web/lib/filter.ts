import { type AffestAssetId } from '@/lib/assets';
import { type SpotSnapshot } from '@/lib/condition';

export const filterFns = ['price', 'mcap', 'volume', 'gain'] as const;
export type FilterFn = (typeof filterFns)[number];
export type FilterOrder = 'top' | 'bottom';

export type FilterSort =
  | { kind: 'unset' }
  | { kind: 'metric'; fn: FilterFn };

export type FilterBlock = {
  sort: FilterSort;
  order: FilterOrder;
  count: number;
};

export const filterFnLabels: Record<FilterFn, string> = {
  price: 'Current Price',
  mcap: 'Current Market Cap',
  volume: 'Volume',
  gain: 'Percent Gain',
};

export const filterFnOptions: { id: FilterFn; label: string }[] = [
  { id: 'price', label: filterFnLabels.price },
  { id: 'mcap', label: filterFnLabels.mcap },
  { id: 'volume', label: filterFnLabels.volume },
  { id: 'gain', label: filterFnLabels.gain },
];

export const filterOrderOptions: { id: FilterOrder; label: string }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
];

export function defaultFilter(): FilterBlock {
  return { sort: { kind: 'unset' }, order: 'top', count: 1 };
}

export function isCompleteFilter(filter: FilterBlock): boolean {
  return filter.sort.kind === 'metric' && filter.count >= 1;
}

export function parseCount(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

function percentGain(spark: number[]): number | undefined {
  const first = spark[0];
  const last = spark[spark.length - 1];
  if (first === undefined || last === undefined || first === 0) return undefined;
  return (last - first) / first;
}

function score(fn: FilterFn, asset: AffestAssetId, prices: SpotSnapshot): number | undefined {
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
    case 'gain':
      return percentGain(spark);
    default: {
      const _exhaustive: never = fn;
      return _exhaustive;
    }
  }
}

export function keptAssets(input: {
  assets: AffestAssetId[];
  filter: FilterBlock;
  prices: SpotSnapshot | undefined;
}): AffestAssetId[] {
  const { assets, filter, prices } = input;
  if (filter.sort.kind !== 'metric' || !prices) return assets;
  const scored: { id: AffestAssetId; value: number }[] = [];
  for (const id of assets) {
    const value = score(filter.sort.fn, id, prices);
    if (value === undefined) continue;
    scored.push({ id, value });
  }
  if (scored.length === 0) return assets;
  scored.sort((a, b) => (filter.order === 'top' ? b.value - a.value : a.value - b.value));
  const n = Math.min(Math.max(filter.count, 1), scored.length);
  return scored.slice(0, n).map((row) => row.id);
}

export function formatFilter(filter: FilterBlock): string {
  const order = filter.order === 'top' ? 'Top' : 'Bottom';
  if (filter.sort.kind === 'unset') return `Sort Select ${order} ${filter.count}`;
  return `Sort ${filterFnLabels[filter.sort.fn]} Select ${order} ${filter.count}`;
}

export function formatFilterSummary(filter: FilterBlock, kept: AffestAssetId[]): string {
  if (filter.sort.kind === 'unset') return 'Filter is waiting on a sort function.';
  const order = filter.order === 'top' ? 'Top' : 'Bottom';
  return `${order} ${filter.count} by ${filterFnLabels[filter.sort.fn]}: ${kept.join(', ')}`;
}
