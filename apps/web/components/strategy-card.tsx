'use client';

import Link from 'next/link';
import { Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useWriteContract } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { wagmiConfig } from '@/lib/chain';
import { cc3Contracts, strategyManagerAbi } from '@/lib/contracts';
import { useOwnedStrategy } from '@/lib/use-cc3';

export function StrategyCard() {
  const owned = useOwnedStrategy();
  const { writeContractAsync, isPending } = useWriteContract();
  const strategy = owned.strategy;

  async function toggle() {
    if (!owned.id) return;
    try {
      const hash = await writeContractAsync({
        abi: strategyManagerAbi,
        address: cc3Contracts.strategyManager,
        functionName: strategy?.status === 1 ? 'resumeStrategy' : 'pauseStrategy',
        args: [owned.id],
      });
      await waitForTransactionReceipt(wagmiConfig, { hash });
      owned.refetch();
      toast(strategy?.status === 1 ? 'Strategy resumed' : 'Strategy paused');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Strategy update failed');
    }
  }

  if (!strategy || !owned.id) {
    return (
      <Card className="p-[22px_23px]">
        <p className="eyebrow accent">Active strategy</p>
        <h2 className="m-0 text-lg font-semibold">None yet</h2>
        <p className="mt-4 text-[12px] leading-relaxed text-[#a2acab]">
          Create a CC3 strategy from your connected wallet. Affest will not invent balances or execution.
        </p>
        <Button className="mt-5" asChild>
          <Link href="/strategies">Create strategy</Link>
        </Button>
      </Card>
    );
  }

  const paused = strategy.status === 1;

  return (
    <Card className="p-[22px_23px]">
      <CardHeader>
        <div>
          <p className="eyebrow accent">Active strategy</p>
          <CardTitle>Strategy #{owned.id.toString()}</CardTitle>
        </div>
        <Button variant="outline" size="sm" disabled={isPending} onClick={() => void toggle()}>
          {paused ? <Play size={15} /> : <Pause size={15} />}
          {paused ? 'Resume' : 'Pause'}
        </Button>
      </CardHeader>
      <CardContent>
        <p className="my-[18px] max-w-[510px] text-[12px] leading-[1.65] text-[#a2acab]">
          Target mix is <b className="font-semibold text-paper">{strategy.stableWeightBps / 100}% WTCTC</b> and{' '}
          <b className="font-semibold text-paper">{strategy.riskWeightBps / 100}% DEMO_RISK</b>. Both portfolio assets are vaulted on CC3. Sepolia ETH is only the source trigger asset.
        </p>
        <div className="grid gap-3 border-y border-[#2b3436] py-4 md:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-[11px] text-[#657173]">TRIGGER</span>
            <b className="block text-[12px]">PortfolioSignal</b>
            <small className="mt-1 block text-[11px] text-[#798586]">Sepolia source event</small>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] text-[#657173]">MODE</span>
            <b className="block text-[12px]">{['Approval', 'Automatic', 'Hybrid'][strategy.mode] ?? 'Hybrid'}</b>
          </div>
          <div>
            <span className="mb-1.5 block text-[11px] text-[#657173]">STATUS</span>
            <b className="block text-[12px]">{paused ? 'Paused' : 'Active'}</b>
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4">
        <span className="text-[11px] text-[#a3b9a2]">{paused ? 'Paused by you' : 'Watching for a verified signal'}</span>
        <Button variant="link" asChild>
          <Link href="/strategies">Edit strategy</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
