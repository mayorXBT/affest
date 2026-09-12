'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Coins, Filter, GitBranch, Percent, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AssetLogo } from '@/components/asset-logo';
import { IfElseCanvas } from '@/components/condition-editor';
import { FilterCanvas } from '@/components/filter-editor';
import { SimulationChart, mixReturnSeries, toReturnSeries } from '@/components/sparkline';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type AffestAssetId, affestAssets, assetById } from '@/lib/assets';
import {
  type IfElseBlock,
  branchLabel,
  conditionHolds,
  defaultIfElse,
  formatCondition,
  formatConditionChip,
  isCompleteCondition,
  mixFromAssets,
  storedTctcPct,
  triggerAsset,
} from '@/lib/condition';
import {
  type FilterBlock,
  defaultFilter,
  formatFilterSummary,
  isCompleteFilter,
  keptAssets,
} from '@/lib/filter';
import { usdFromAmount, useSpotPrices } from '@/lib/prices';
import { readDraft, saveDraft } from '@/lib/strategy-drafts';
import { templateById } from '@/lib/strategy-templates';
import { formatAmount, useCc3Holdings, useOwnedStrategies } from '@/lib/use-cc3';
import { useCreateStrategy } from '@/lib/use-create-strategy';

type WeightMode = 'equal' | 'specified';
type Menu = 'closed' | 'blocks' | 'assets';

const blockCatalog = [
  { id: 'asset', label: 'Asset', detail: 'Add TCTC on CC3 or ETH on Sepolia', icon: Coins, tone: 'bg-[#efe6c8] text-[#3d3416]' },
  { id: 'weight', label: 'Weight (Allocation)', detail: 'Decide the balance between your assets', icon: Percent, tone: 'bg-[#b8f0c8] text-[#16321d]' },
  { id: 'condition', label: 'If/Else (Conditional)', detail: 'If this happens, hold this. Else hold that.', icon: GitBranch, tone: 'bg-[#bfe6f5] text-[#16323d]' },
  { id: 'filter', label: 'Filter', detail: 'Keep the top or bottom N by price, cap, volume, or gain', icon: Filter, tone: 'bg-[#c9d4f5] text-[#1b2440]' },
] as const;

export function StrategyBuilder() {
  const holdings = useCc3Holdings();
  const prices = useSpotPrices();
  const search = useSearchParams();
  const preset = templateById(search.get('template'));
  const { create, isPending } = useCreateStrategy();
  const owned = useOwnedStrategies();
  const editId = search.get('edit');
  const [weightMode, setWeightMode] = useState<WeightMode>(preset && preset.tctcPct !== 50 ? 'specified' : 'equal');
  const [tctcPct, setTctcPct] = useState<number>(preset?.tctcPct ?? 50);
  const [assets, setAssets] = useState<AffestAssetId[]>(['TCTC', 'ETH']);
  const [ifElse, setIfElse] = useState<IfElseBlock | undefined>();
  const [filter, setFilter] = useState<FilterBlock | undefined>();
  const [conditionOpen, setConditionOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [menu, setMenu] = useState<Menu>('closed');
  const [weightOpen, setWeightOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const [createdId, setCreatedId] = useState<string | undefined>();
  const [amountUsd, setAmountUsd] = useState('');

  useEffect(() => {
    if (!editId) return;
    const draft = readDraft(editId);
    if (!draft) return;
    setWeightMode(draft.weightMode);
    setTctcPct(draft.tctcPct);
    setAssets(draft.assets.length > 0 ? draft.assets : ['TCTC', 'ETH']);
    setIfElse(draft.ifElse);
    setFilter(draft.filter);
    setAmountUsd(draft.allocatedUsd ? String(draft.allocatedUsd) : '');
    setCreated(true);
    setCreatedId(draft.id);
  }, [editId]);

  const holds = ifElse ? conditionHolds(ifElse.condition, prices.data) : undefined;
  const activeBranch = ifElse
    ? (holds === undefined ? undefined : holds ? ifElse.thenAssets : ifElse.elseAssets)
    : undefined;
  const universe = ifElse ? [...new Set([...ifElse.thenAssets, ...ifElse.elseAssets])] : assets;
  const kept = filter
    ? keptAssets({ assets: universe, filter, prices: prices.data })
    : universe;

  const weights = useMemo(() => {
    const winner = kept.length === 1 ? kept[0] : undefined;
    if (winner) {
      return { TCTC: winner === 'TCTC' ? 100 : 0, ETH: winner === 'ETH' ? 100 : 0 };
    }
    if (activeBranch) return mixFromAssets(activeBranch);
    if (ifElse) return mixFromAssets(ifElse.thenAssets);
    if (weightMode === 'equal') {
      const each = Math.floor(100 / Math.max(assets.length, 1));
      return { TCTC: assets.includes('TCTC') ? each : 0, ETH: assets.includes('ETH') ? 100 - (assets.includes('TCTC') ? each : 0) : 0 };
    }
    return { TCTC: tctcPct, ETH: 100 - tctcPct };
  }, [activeBranch, assets, ifElse, kept, tctcPct, weightMode]);

  function addAsset(key: AffestAssetId) {
    setAssets((current) => (current.includes(key) ? current : [...current, key]));
    setMenu('closed');
  }

  function addBlock(id: (typeof blockCatalog)[number]['id']) {
    if (id === 'asset') {
      if (ifElse) {
        toast('Add TCTC or ETH on the Then / Else branches');
        setMenu('closed');
        return;
      }
      setMenu('assets');
      return;
    }
    setMenu('closed');
    if (id === 'weight') {
      setConditionOpen(false);
      setFilterOpen(false);
      setWeightOpen(true);
    }
    if (id === 'condition') {
      setWeightOpen(false);
      setFilterOpen(false);
      setIfElse((current) => current ?? defaultIfElse());
      setConditionOpen(false);
    }
    if (id === 'filter') {
      setWeightOpen(false);
      setConditionOpen(false);
      setFilter((current) => current ?? defaultFilter());
      setFilterOpen(true);
    }
  }

  async function createStrategy() {
    if (ifElse && !isCompleteCondition(ifElse.condition)) {
      toast('Finish the If/Else condition');
      setConditionOpen(true);
      return;
    }
    if (ifElse && ifElse.thenAssets.length === 0) {
      toast('Add an asset to the Then branch');
      return;
    }
    if (ifElse && ifElse.elseAssets.length === 0) {
      toast('Add an asset to the Else branch');
      return;
    }
    if (filter && !isCompleteFilter(filter)) {
      toast('Finish the filter');
      setFilterOpen(true);
      return;
    }
    const pair = ifElse ? [...ifElse.thenAssets, ...ifElse.elseAssets] : assets;
    if (!pair.includes('TCTC') || !pair.includes('ETH')) {
      toast('Add both TCTC and ETH before creating');
      return;
    }
    const winner = kept.length === 1 ? kept[0] : undefined;
    try {
      const createdOnChain = await create({
        tctcPct: winner ? (winner === 'TCTC' ? 90 : 10) : ifElse ? storedTctcPct(ifElse.thenAssets) : weights.TCTC,
        trigger: winner ?? (ifElse ? triggerAsset(ifElse) : 'ETH'),
        minimum: '1',
      });
      const allocatedUsd = Number(amountUsd);
      saveDraft({
        id: createdOnChain.strategyId,
        savedAt: Date.now(),
        name: ifElse ? formatConditionChip(ifElse.condition) : `Strategy #${createdOnChain.strategyId}`,
        detail: ifElse
          ? `If ${formatCondition(ifElse.condition)}, hold ${branchLabel(ifElse.thenAssets)}. Else hold ${branchLabel(ifElse.elseAssets)}.`
          : `${weights.TCTC}% TCTC / ${weights.ETH}% ETH`,
        weightMode,
        tctcPct: weights.TCTC,
        assets,
        ifElse,
        filter,
        allocatedUsd: allocatedUsd > 0 ? allocatedUsd : undefined,
        baselineCtcUsd: prices.data?.ctcUsd,
        baselineEthUsd: prices.data?.ethUsd,
        baselineTctcPct: weights.TCTC,
      });
      setCreated(true);
      setCreatedId(createdOnChain.strategyId);
      owned.refetch();
      toast('Strategy created on CC3');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Strategy creation failed');
    }
  }

  return (
    <div className="strategy-builder-shell mt-6 grid min-h-[640px] rounded-xl border border-line lg:grid-cols-[1fr_320px]">
      <section className="strategy-builder-canvas canvas-dots relative min-h-[640px] p-5">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="m-0 text-[18px] font-semibold">New strategy</h2>
            <Badge variant="waiting">{created ? 'Created' : 'Draft'}</Badge>
          </div>
          <div className="flex gap-2">
            {createdId ? (
              <Button variant="outline" asChild>
                <Link href={`/strategies/${createdId}`}>View</Link>
              </Button>
            ) : null}
            <Button disabled={isPending} onClick={() => void createStrategy()}>
              Create strategy
            </Button>
          </div>
        </div>

        <div className="strategy-builder-controls absolute top-24 left-10 flex flex-col items-start gap-3">
          <div className="relative">
            <button
              type="button"
              data-block="weight"
              onClick={() => {
                setConditionOpen(false);
                setFilterOpen(false);
                setMenu('closed');
                setWeightOpen((value) => !value);
              }}
              className="rounded-full bg-[#b8f0c8] px-4 py-2 text-[13px] font-semibold text-[#16321d]"
            >
              {weightMode === 'equal' ? 'Weight equal' : 'Weight specified percentage'} ▾
            </button>
            {weightOpen ? (
              <div className="absolute z-20 w-56 rounded-xl border border-line bg-ink-2 p-2 max-lg:top-[calc(100%+8px)] max-lg:left-0 lg:top-0 lg:left-[calc(100%+8px)]">
                <p className="px-2 pb-1 text-[11px] text-[#899596]">Set weighting type</p>
                {(['equal', 'specified'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[13px] hover:bg-ink-3"
                    onClick={() => {
                      setWeightMode(mode);
                      setWeightOpen(false);
                    }}
                  >
                    {mode === 'equal' ? 'Equal' : 'Specified percentage'}
                    {weightMode === mode ? <span className="text-lime">✓</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {filter ? (
            <FilterCanvas
              block={filter}
              open={filterOpen}
              onToggle={() => {
                setWeightOpen(false);
                setConditionOpen(false);
                setMenu('closed');
                setFilterOpen((value) => !value);
              }}
              onChange={setFilter}
              onRemove={() => {
                setFilter(undefined);
                setFilterOpen(false);
              }}
            />
          ) : null}

          <div className={filter ? 'ml-6 flex flex-col items-start gap-3' : 'contents'}>
          {ifElse ? (
            <IfElseCanvas
              block={ifElse}
              open={conditionOpen}
              onToggle={() => {
                setWeightOpen(false);
                setFilterOpen(false);
                setMenu('closed');
                setConditionOpen((value) => !value);
              }}
              onChange={setIfElse}
              onRemove={() => {
                setIfElse(undefined);
                setConditionOpen(false);
                setAssets(['TCTC', 'ETH']);
              }}
            />
          ) : (
            assets.map((key) => {
              const item = assetById(key);
              const dropped = filter && isCompleteFilter(filter) && !kept.includes(key);
              return (
                <div key={key} className={`flex items-center gap-2 ${dropped ? 'opacity-40' : ''}`}>
                  {weightMode === 'specified' ? (
                    <select
                      className="rounded-full bg-[#b8f0c8] px-3 py-1.5 text-[12px] font-semibold text-[#16321d]"
                      value={key === 'TCTC' ? weights.TCTC : weights.ETH}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        setTctcPct(key === 'TCTC' ? value : 100 - value);
                      }}
                    >
                      {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((value) => (
                        <option key={value} value={value}>{value}%</option>
                      ))}
                    </select>
                  ) : null}
                  <button
                    type="button"
                    data-block={`asset-${item.id}`}
                    className="flex items-center gap-2 rounded-full bg-[#efe6c8] px-3 py-2 text-[13px] font-semibold text-[#3d3416]"
                  >
                    <AssetLogo kind={item.id} size={18} />
                    {item.symbol}
                  </button>
                  <button
                    type="button"
                    className="grid size-8 place-items-center rounded-full border border-[#3a2a2a] text-[#f0b3a5]"
                    aria-label={`Remove ${item.symbol}`}
                    onClick={() => setAssets((current) => current.filter((entry) => entry !== key))}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })
          )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setWeightOpen(false);
                setConditionOpen(false);
                setFilterOpen(false);
                setMenu((value) => (value === 'closed' ? 'blocks' : 'closed'));
              }}
              className="grid size-9 place-items-center rounded-full border border-[#3a4548] bg-[#1b2124] text-paper"
              aria-label="Add block"
            >
              <Plus size={16} />
            </button>
            {menu !== 'closed' ? (
              <div className="absolute z-20 w-[min(320px,calc(100vw-3rem))] rounded-2xl border border-line bg-ink-2 p-3 max-lg:top-[calc(100%+8px)] max-lg:left-0 lg:top-0 lg:left-12">
                {menu === 'assets' ? (
                  <>
                    <button
                      type="button"
                      className="mb-2 text-[12px] text-[#899596]"
                      onClick={() => setMenu('blocks')}
                    >
                      ← Blocks
                    </button>
                    <p className="mb-2 text-[13px] font-semibold">Add asset</p>
                    {affestAssets.map((item) => {
                      const onCanvas = assets.includes(item.id);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink-3"
                          data-catalog={`asset-${item.id}`}
                          onClick={() => addAsset(item.id)}
                        >
                          <span className="grid size-9 place-items-center rounded-xl bg-[#efe6c8] text-[#3d3416]">
                            <AssetLogo kind={item.id} size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <b className="block text-[13px]">{item.symbol}</b>
                            <small className="text-[11px] text-[#899596]">{item.chainLabel}</small>
                          </span>
                          {onCanvas ? <span className="shrink-0 text-[11px] text-lime">On canvas</span> : null}
                        </button>
                      );
                    })}
                  </>
                ) : (
                  <>
                    <p className="mb-2 text-[13px] font-semibold">Add block</p>
                    {blockCatalog.map((block) => (
                      <button
                        key={block.id}
                        type="button"
                        className="mb-1 flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-ink-3"
                        data-catalog={block.id}
                        onClick={() => addBlock(block.id)}
                      >
                        <span className={`grid size-9 place-items-center rounded-xl ${block.tone}`}>
                          <block.icon size={16} />
                        </span>
                        <span>
                          <b className="block text-[13px]">{block.label}</b>
                          <small className="text-[11px] text-[#899596]">{block.detail}</small>
                        </span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <aside className="flex flex-col border-t border-line bg-[#12171a] p-4 lg:border-t-0 lg:border-l">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="m-0 text-[14px] font-semibold">Portfolio simulation</h3>
          <Badge variant="muted">Beta</Badge>
        </div>
        <SimulationChart
          strategy={mixReturnSeries(
            toReturnSeries(prices.data?.ctcSpark ?? []),
            toReturnSeries(prices.data?.ethSpark ?? []),
            weights.TCTC / 100,
          )}
          eth={toReturnSeries(prices.data?.ethSpark ?? [])}
          tctc={toReturnSeries(prices.data?.ctcSpark ?? [])}
        />
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-semibold">Your assets</p>
          <div className="mb-2 flex items-center justify-between text-[12px] text-[#a2acab]">
            <span className="flex items-center gap-2"><AssetLogo kind="TCTC" size={16} /> TCTC</span>
            <span className="tabular">{formatAmount(holdings.tctc)}</span>
          </div>
          <div className="mb-4 flex items-center justify-between text-[12px] text-[#a2acab]">
            <span className="flex items-center gap-2"><AssetLogo kind="ETH" size={16} /> ETH</span>
            <span className="tabular">{formatAmount(holdings.eth)}</span>
          </div>
          <p className="mb-2 text-[13px] font-semibold">Amount this strategy tracks</p>
          <div className="mb-4 flex items-center gap-2">
            <input
              className="h-8 min-w-0 flex-1 rounded-md border border-[#354044] bg-[#101618] px-2 text-[12px]"
              value={amountUsd}
              placeholder="USD"
              inputMode="decimal"
              onChange={(event) => setAmountUsd(event.target.value)}
            />
            <button
              type="button"
              className="h-8 rounded-md border border-[#3a4548] px-2 text-[11px] text-[#a2acab]"
              onClick={() => {
                const tctcUsd = usdFromAmount(holdings.vaultTctc + holdings.wrappedTctc + holdings.tctc, prices.data?.ctcUsd ?? 0) ?? 0;
                const ethUsd = usdFromAmount(holdings.eth + holdings.weth, prices.data?.ethUsd ?? 0) ?? 0;
                const bag = tctcUsd + ethUsd;
                if (bag > 0) setAmountUsd(bag.toFixed(2));
              }}
            >
              Max
            </button>
          </div>
          <p className="mt-0 mb-4 text-[11px] leading-relaxed text-[#6f7c7d]">
            Leave empty to value this mix against your current TCTC/ETH bag. Set a dollar amount if this strategy should only track part of it.
          </p>
          <p className="mb-2 text-[13px] font-semibold">Your new portfolio</p>
          {affestAssets.map((item) => (
            <div key={item.id} className="mb-2 flex items-center gap-2">
              <AssetLogo kind={item.id} size={16} />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex justify-between text-[12px]"><span>{item.symbol}</span><span>{weights[item.id].toFixed(1)}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-[#2a3438]">
                  <div className={`h-full ${item.id === 'TCTC' ? 'bg-[#9b7fe6]' : 'bg-[#7f92e6]'}`} style={{ width: `${weights[item.id]}%` }} />
                </div>
              </div>
            </div>
          ))}
          {filter ? (
            <p className="mt-3 mb-0 text-[11px] leading-relaxed text-[#6f7c7d]">
              {formatFilterSummary(filter, kept)}
            </p>
          ) : null}
          {ifElse ? (
            <p className="mt-3 mb-0 text-[11px] leading-relaxed text-[#6f7c7d]">
              If {formatCondition(ifElse.condition)}, hold {branchLabel(ifElse.thenAssets)}. Else hold {branchLabel(ifElse.elseAssets)}.
              {holds === undefined ? '' : holds ? ' Condition is true now.' : ' Condition is false now.'}
            </p>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
