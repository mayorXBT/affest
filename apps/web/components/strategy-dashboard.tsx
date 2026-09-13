'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Pause, Play, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { AssetLogo } from '@/components/asset-logo';
import { SimulationChart, mixReturnSeries, toReturnSeries } from '@/components/sparkline';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { wagmiConfig } from '@/lib/chain';
import { cc3Contracts, sepoliaContracts, strategyManagerAbi } from '@/lib/contracts';
import { useSpotPrices } from '@/lib/prices';
import { StrategyName } from '@/components/strategy-actions';
import { StrategyReadiness } from '@/components/strategy-readiness';
import { readDraft } from '@/lib/strategy-drafts';
import { formatPct, formatUsd, strategyMetrics } from '@/lib/strategy-value';
import { formatAmount, useCc3Holdings, useOwnedStrategies } from '@/lib/use-cc3';

export function StrategyDashboard({ id }: { id: string }) {
  const owned = useOwnedStrategies();
  const prices = useSpotPrices();
  const { writeContractAsync, isPending } = useWriteContract();
  const [range, setRange] = useState<'1D' | '1W'>('1W');
  const row = owned.items.find((item) => item.id.toString() === id);
  const strategy = row?.strategy;
  const holdings = useCc3Holdings(strategy?.vault);
  const paused = strategy?.status === 1;
  const ethUsd = prices.data?.ethUsd ?? 0;
  const ctcUsd = prices.data?.ctcUsd ?? 0;
  const metrics = strategyMetrics({
    tctcPct: (strategy?.stableWeightBps ?? 5000) / 100,
    tctcHoldings: holdings.vaultTctc + holdings.wrappedTctc + holdings.tctc,
    ethHoldings: holdings.eth + holdings.weth,
    ctcUsd,
    ethUsd,
    ctcSpark: prices.data?.ctcSpark ?? [],
    ethSpark: prices.data?.ethSpark ?? [],
    draft: readDraft(id),
  });
  const totalUsd = metrics.currentUsd;
  const ethSpark = prices.data?.ethSpark ?? [];
  const ctcSpark = prices.data?.ctcSpark ?? [];
  const slice = range === '1D' ? 24 : ethSpark.length;
  const ethSeries = toReturnSeries(ethSpark.slice(-slice));
  const ctcSeries = toReturnSeries(ctcSpark.slice(-slice));
  const mix = mixReturnSeries(ctcSeries, ethSeries, (strategy?.stableWeightBps ?? 5000) / 10_000);

  const nextLabel = useMemo(() => {
    if (!strategy) return '—';
    if (paused) return 'Paused';
    if (strategy.lastExecutionAt === 0n || strategy.cooldownSeconds === 0n) return 'On verified signal';
    const next = Number(strategy.lastExecutionAt + strategy.cooldownSeconds) * 1000;
    if (next <= Date.now()) return 'Ready on next proof';
    return new Date(next).toLocaleString();
  }, [paused, strategy]);

  async function toggle() {
    if (!row) return;
    try {
      const hash = await writeContractAsync({
        abi: strategyManagerAbi,
        address: cc3Contracts.strategyManager,
        functionName: paused ? 'resumeStrategy' : 'pauseStrategy',
        args: [row.id],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      owned.refetch();
      toast(paused ? 'Strategy resumed' : 'Strategy paused');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Strategy update failed');
    }
  }

  function rebalanceNow() {
    if (!strategy) return;
    if (paused) {
      toast('Resume the strategy first');
      return;
    }
    toast('Rebalance waits for a verified Sepolia PortfolioSignal. Affest does not discretionary-swap from this screen.');
  }

  if (owned.loading) {
    return <p className="mt-6 text-[13px] text-[#8f9a9b]">Reading strategy #{id} on CC3.</p>;
  }

  if (!row || !strategy) {
    return (
      <Card className="mt-6 p-6">
        <b className="block text-[15px]">Strategy not found</b>
        <p className="mt-2 text-[12px] text-[#8f9a9b]">This wallet does not own strategy #{id}, or it was revoked.</p>
        <Button className="mt-4" asChild>
          <Link href="/">Back to overview</Link>
        </Button>
      </Card>
    );
  }

  return (
    <div className="mt-6 grid gap-3.5 lg:grid-cols-[1.4fr_0.8fr]">
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <AssetLogo kind="TCTC" size={22} />
              <AssetLogo kind="ETH" size={22} />
              <h2 className="m-0 text-[18px] font-semibold"><StrategyName id={id} /></h2>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${paused ? 'bg-[#2b2418] text-[#f5b96a]' : 'bg-[#1c3a26] text-[#8fef9a]'}`}>
                {paused ? 'Paused' : 'Active'}
              </span>
            </div>
            <small className="mt-1 block text-[12px] text-[#788484]">
              {strategy.stableWeightBps / 100}% TCTC vaulted on CC3 · {strategy.riskWeightBps / 100}% ETH Sepolia
              · if verified {strategy.triggerAsset.toLowerCase() === sepoliaContracts.weth.toLowerCase() ? 'ETH' : 'TCTC'} ≥ {formatAmount(strategy.minimumTriggerAmount)}, rebalance
            </small>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => void toggle()}>
              {paused ? <Play size={14} /> : <Pause size={14} />}
              {paused ? 'Resume' : 'Pause'}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/strategies?edit=${row.id.toString()}`}>Edit</Link>
            </Button>
          </div>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[36px] leading-none font-semibold tracking-[-0.06em] tabular">{formatUsd(totalUsd)}</div>
            <small className={`mt-2 block text-[12px] ${metrics.totalReturn !== undefined && metrics.totalReturn >= 0 ? 'text-[#8fef9a]' : 'text-[#f0b3a5]'}`}>
              {metrics.totalReturn === undefined ? 'Set an amount to track return' : `${formatPct(metrics.totalReturn)} on this mix`}
            </small>
          </div>
          <div className="flex gap-1 text-[11px]">
            {(['1D', '1W'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setRange(item)}
                className={`rounded-full px-2 py-1 ${range === item ? 'bg-ink-3 text-paper' : 'text-[#6f7c7d]'}`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <SimulationChart strategy={mix} eth={ethSeries} tctc={ctcSeries} />
        </div>
      </Card>
      <div className="grid gap-3.5">
        <Card className="p-5">
          <p className="eyebrow">Next rebalance</p>
          <b className="mt-2 block text-[16px]">{nextLabel}</b>
          <small className="mt-1 block text-[12px] text-[#788484]">
            Hybrid mode. Execution still requires a verified PortfolioSignal.
          </small>
          <Button className="mt-4 w-full" disabled={isPending} onClick={rebalanceNow}>
            <RefreshCw size={14} />
            Rebalance now
          </Button>
        </Card>
        <Card className="p-5">
          <p className="eyebrow">Holdings</p>
          <div className="mt-3 border-b border-line pb-3">
            <StrategyReadiness strategy={strategy} />
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2"><AssetLogo kind="TCTC" size={18} /> TCTC in vault</span>
            <span className="tabular">{formatAmount(holdings.vaultTctc)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[13px]">
            <span className="flex items-center gap-2"><AssetLogo kind="ETH" size={18} /> ETH on Sepolia</span>
            <span className="tabular">{formatAmount(holdings.eth + holdings.weth)}</span>
          </div>
          <small className="mt-2 block text-[11px] text-[#6f7c7d]">
            24h mix {formatPct(metrics.dayReturn)}
          </small>
          <div className="mt-4 flex gap-2">
            <Button className="flex-1" asChild>
              <Link href={`/portfolio?strategyId=${row.id.toString()}`}>Deposit</Link>
            </Button>
            <Button className="flex-1" variant="outline" asChild>
              <Link href={`/portfolio?strategyId=${row.id.toString()}`}>Withdraw</Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
