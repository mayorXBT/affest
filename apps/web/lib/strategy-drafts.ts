import { type AffestAssetId } from '@/lib/assets';
import {
  type Comparator,
  type Condition,
  type ConditionSide,
  type IfElseBlock,
  type MetricFn,
} from '@/lib/condition';
import { type FilterBlock, type FilterFn, type FilterOrder } from '@/lib/filter';

const KEY = 'affest.strategy.drafts';

export type StrategyDraft = {
  id: string;
  savedAt: number;
  name: string;
  detail: string;
  weightMode: 'equal' | 'specified';
  tctcPct: number;
  assets: AffestAssetId[];
  ifElse?: IfElseBlock;
  filter?: FilterBlock;
  allocatedUsd?: number;
  baselineCtcUsd?: number;
  baselineEthUsd?: number;
  baselineTctcPct?: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isAssetId(value: unknown): value is AffestAssetId {
  return value === 'TCTC' || value === 'ETH';
}

function isMetricFn(value: unknown): value is MetricFn {
  return value === 'price' || value === 'mcap' || value === 'volume' || value === 'sma' || value === 'ema';
}

function isFilterFn(value: unknown): value is FilterFn {
  return value === 'price' || value === 'mcap' || value === 'volume' || value === 'gain';
}

function parseSide(value: unknown): ConditionSide | undefined {
  if (!isRecord(value) || typeof value.kind !== 'string') return undefined;
  if (value.kind === 'empty') return { kind: 'empty' };
  if (value.kind === 'fixed' && typeof value.value === 'string') return { kind: 'fixed', value: value.value };
  if (value.kind === 'metric' && isMetricFn(value.fn) && isAssetId(value.asset)) {
    return { kind: 'metric', fn: value.fn, asset: value.asset };
  }
  return undefined;
}

function parseCondition(value: unknown): Condition | undefined {
  if (!isRecord(value)) return undefined;
  const left = parseSide(value.left);
  const right = parseSide(value.right);
  const comparator = value.comparator;
  if (!left || !right || (comparator !== 'greater' && comparator !== 'less')) return undefined;
  const cmp: Comparator = comparator;
  return { left, right, comparator: cmp };
}

function parseIfElse(value: unknown): IfElseBlock | undefined {
  if (!isRecord(value) || !Array.isArray(value.thenAssets) || !Array.isArray(value.elseAssets)) return undefined;
  const condition = parseCondition(value.condition);
  if (!condition) return undefined;
  const thenAssets = value.thenAssets.filter(isAssetId);
  const elseAssets = value.elseAssets.filter(isAssetId);
  return { condition, thenAssets, elseAssets };
}

function parseFilter(value: unknown): FilterBlock | undefined {
  if (!isRecord(value) || (value.order !== 'top' && value.order !== 'bottom')) return undefined;
  const order: FilterOrder = value.order;
  const count = typeof value.count === 'number' && value.count >= 1 ? Math.floor(value.count) : 1;
  if (!isRecord(value.sort) || typeof value.sort.kind !== 'string') return undefined;
  if (value.sort.kind === 'unset') return { sort: { kind: 'unset' }, order, count };
  if (value.sort.kind === 'metric' && isFilterFn(value.sort.fn)) {
    return { sort: { kind: 'metric', fn: value.sort.fn }, order, count };
  }
  return undefined;
}

function parseDraft(value: unknown): StrategyDraft | undefined {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return undefined;
  if (value.weightMode !== 'equal' && value.weightMode !== 'specified') return undefined;
  if (typeof value.tctcPct !== 'number' || !Array.isArray(value.assets)) return undefined;
  const assets = value.assets.filter(isAssetId);
  const ifElse = value.ifElse === undefined ? undefined : parseIfElse(value.ifElse);
  const filter = value.filter === undefined ? undefined : parseFilter(value.filter);
  return {
    id: value.id,
    savedAt: typeof value.savedAt === 'number' ? value.savedAt : Date.now(),
    name: value.name,
    detail: typeof value.detail === 'string' ? value.detail : '',
    weightMode: value.weightMode,
    tctcPct: value.tctcPct,
    assets,
    ifElse,
    filter,
    allocatedUsd: typeof value.allocatedUsd === 'number' && value.allocatedUsd > 0 ? value.allocatedUsd : undefined,
    baselineCtcUsd: typeof value.baselineCtcUsd === 'number' && value.baselineCtcUsd > 0 ? value.baselineCtcUsd : undefined,
    baselineEthUsd: typeof value.baselineEthUsd === 'number' && value.baselineEthUsd > 0 ? value.baselineEthUsd : undefined,
    baselineTctcPct: typeof value.baselineTctcPct === 'number' ? value.baselineTctcPct : undefined,
  };
}

export function listDrafts(): StrategyDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw: unknown = JSON.parse(window.localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(parseDraft).filter((entry): entry is StrategyDraft => Boolean(entry));
  } catch {
    return [];
  }
}

export function readDraft(id: string): StrategyDraft | undefined {
  return listDrafts().find((entry) => entry.id === id);
}

export function saveDraft(draft: StrategyDraft): void {
  if (typeof window === 'undefined') return;
  const next = [draft, ...listDrafts().filter((entry) => entry.id !== draft.id)].slice(0, 20);
  window.localStorage.setItem(KEY, JSON.stringify(next));
  window.dispatchEvent(new Event('affest-drafts-changed'));
}

export function displayName(id: string, fallback = `Strategy #${id}`): string {
  const draft = readDraft(id);
  if (!draft?.name || draft.name === 'Set Condition') return fallback;
  return draft.name;
}

function stubDraft(id: string): StrategyDraft {
  const existing = readDraft(id);
  if (existing) return existing;
  return {
    id,
    savedAt: Date.now(),
    name: `Strategy #${id}`,
    detail: '',
    weightMode: 'equal',
    tctcPct: 50,
    assets: ['TCTC', 'ETH'],
  };
}

export function renameDraft(id: string, name: string): void {
  const trimmed = name.trim();
  if (!trimmed) return;
  saveDraft({ ...stubDraft(id), name: trimmed });
}

export function setDraftAmount(input: {
  id: string;
  allocatedUsd: number;
  ctcUsd: number;
  ethUsd: number;
  tctcPct: number;
}): void {
  if (!(input.allocatedUsd > 0) || !(input.ctcUsd > 0) || !(input.ethUsd > 0)) return;
  const current = stubDraft(input.id);
  saveDraft({
    ...current,
    allocatedUsd: input.allocatedUsd,
    baselineCtcUsd: input.ctcUsd,
    baselineEthUsd: input.ethUsd,
    baselineTctcPct: input.tctcPct,
  });
}
