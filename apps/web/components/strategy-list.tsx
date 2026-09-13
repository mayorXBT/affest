'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AssetLogo } from '@/components/asset-logo';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StrategyActions, StrategyName } from '@/components/strategy-actions';
import { StrategyReadiness } from '@/components/strategy-readiness';
import { useSpotPrices } from '@/lib/prices';
import { readDraft } from '@/lib/strategy-drafts';
import { formatPct, formatUsd, strategyMetrics } from '@/lib/strategy-value';
import { useCc3Holdings, useOwnedStrategies } from '@/lib/use-cc3';

const columns = 'grid-cols-[minmax(200px,1.5fr)_112px_minmax(150px,1fr)_104px_96px_96px_124px]';

export function StrategyList() {
  const owned = useOwnedStrategies();
  const holdings = useCc3Holdings();
  const prices = useSpotPrices();
  const [tab, setTab] = useState<'active' | 'paused'>('active');
  const [draftTick, setDraftTick] = useState(0);

  useEffect(() => {
    function refresh() {
      setDraftTick((value) => value + 1);
    }
    window.addEventListener('affest-drafts-changed', refresh);
    return () => window.removeEventListener('affest-drafts-changed', refresh);
  }, []);
  const ethUsd = prices.data?.ethUsd ?? 0;
  const ctcUsd = prices.data?.ctcUsd ?? 0;
  const rows = owned.items.filter((item) => (tab === 'paused' ? item.strategy.status === 1 : item.strategy.status === 0));

  return (
    <Card className="mt-4 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-[16px] font-semibold">My strategies</h2>
          <div className="mt-2 flex gap-1">
            {(['active', 'paused'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`rounded-full px-3 py-1 text-[12px] ${tab === item ? 'bg-[#1c3a26] text-[#8fef9a]' : 'text-[#8f9a9b]'}`}
              >
                {item === 'active' ? 'Active' : 'Paused'}
              </button>
            ))}
          </div>
        </div>
        <Button asChild>
          <Link href="/strategies">Create new strategy</Link>
        </Button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className={`grid ${columns} items-center gap-x-4 border-b border-[#2b3436] px-2 pb-2 text-[11px] text-[#6f7c7d]`}>
            <span>Strategy</span>
            <span>Current tokens</span>
            <span>Next rebalance</span>
            <span className="text-right">Current value</span>
            <span className="text-right">Total return</span>
            <span className="text-right">24h return</span>
            <span />
          </div>
          {owned.loading ? (
            <p className="px-2 py-6 text-[13px] text-[#8f9a9b]">Reading strategies on CC3.</p>
          ) : rows.length === 0 ? (
            <div className="px-2 py-6">
              <b className="block text-[13px]">{tab === 'active' ? 'No active strategy yet' : 'No paused strategies'}</b>
              <small className="mt-1 block text-[12px] text-[#788484]">Create one, then open it to view mix and rebalance.</small>
            </div>
          ) : (
            <ul className="m-0 list-none p-0" data-draft-tick={draftTick}>
              {rows.map((row) => {
                const paused = row.strategy.status === 1;
                const tctcPct = row.strategy.stableWeightBps / 100;
                const metrics = strategyMetrics({
                  tctcPct,
                  tctcHoldings: holdings.vaultTctc + holdings.wrappedTctc + holdings.tctc,
                  ethHoldings: holdings.eth + holdings.weth,
                  ctcUsd,
                  ethUsd,
                  ctcSpark: prices.data?.ctcSpark ?? [],
                  ethSpark: prices.data?.ethSpark ?? [],
                  draft: readDraft(row.id.toString()),
                });
                return (
                  <li key={row.id.toString()} className={`grid ${columns} items-center gap-x-4 border-b border-[#2b3436] px-2 py-3 last:border-b-0`}>
                    <div className="flex min-w-0 items-center gap-2">
                      <i className={`size-2 shrink-0 rounded-full ${paused ? 'bg-[#f5b96a]' : 'bg-[#8fef9a]'}`} />
                      <div className="min-w-0">
                        <b className="block truncate text-[13px]"><StrategyName id={row.id.toString()} /></b>
                        <small className="block truncate text-[11px] text-[#6f7c7d]">{row.strategy.stableWeightBps / 100}% WTCTC / {row.strategy.riskWeightBps / 100}% DEMO_RISK</small>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <AssetLogo kind="TCTC" size={18} />
                      <AssetLogo kind="ETH" size={18} />
                    </div>
                    <StrategyReadiness strategy={row.strategy} />
                    <span className="text-right text-[12px] tabular">{holdings.isConnected ? formatUsd(metrics.currentUsd) : '—'}</span>
                    <span className={`text-right text-[12px] tabular ${metrics.totalReturn !== undefined && metrics.totalReturn >= 0 ? 'text-[#8fef9a]' : 'text-[#f0b3a5]'}`}>
                      {formatPct(metrics.totalReturn)}
                    </span>
                    <span className={`text-right text-[12px] tabular ${metrics.dayReturn !== undefined && metrics.dayReturn >= 0 ? 'text-[#8fef9a]' : 'text-[#f0b3a5]'}`}>
                      {formatPct(metrics.dayReturn)}
                    </span>
                    <StrategyActions id={row.id.toString()} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Card>
  );
}
