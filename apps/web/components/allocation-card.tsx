'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatAmount, useCc3Holdings } from '@/lib/use-cc3';

export function AllocationCard() {
  const holdings = useCc3Holdings();
  const total = holdings.tctc + holdings.eth;
  const tctcPct = total === 0n ? 0 : Number((holdings.tctc * 100n) / total);
  const ethPct = total === 0n ? 0 : 100 - tctcPct;
  const ready = holdings.isConnected;

  return (
    <Card className="p-[21px_23px]">
      <CardHeader>
        <div>
          <div className="eyebrow">Allocation</div>
          <b className="text-[13px] font-semibold">{ready && total > 0n ? 'Wallet mix' : 'No allocation yet'}</b>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/portfolio">
            View details <ChevronRight size={14} />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {ready && total > 0n ? (
          <div className="mt-3 flex items-center justify-center gap-8">
            <div
              className="donut"
              aria-hidden="true"
              style={{ background: `conic-gradient(var(--lime) 0 ${tctcPct}%, var(--risk) ${tctcPct}% 100%)` }}
            >
              <div>
                <strong className="block text-xl tracking-[-0.05em]">{tctcPct}%</strong>
                <small className="mt-0.5 block text-[11px] text-[#808b8b]">TCTC</small>
              </div>
            </div>
            <p className="sr-only">
              {tctcPct}% TCTC, {ethPct}% ETH
            </p>
            <div className="w-40 text-[12px] text-[#a2acab]">
              <div className="my-3 flex items-center gap-2">
                <i className="inline-block size-2 rounded-[2px] bg-lime" />
                TCTC
                <b className="ml-auto text-[11px] text-paper tabular">{formatAmount(holdings.tctc)}</b>
              </div>
              <div className="my-3 flex items-center gap-2">
                <i className="inline-block size-2 rounded-[2px] bg-risk" />
                ETH
                <b className="ml-auto text-[11px] text-paper tabular">{formatAmount(holdings.eth)}</b>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6">
            <b className="block text-[12px]">Allocation appears after a wallet is connected.</b>
            <small className="mt-1 block text-[12px] leading-relaxed text-[#788484]">
              Affest reads TCTC on Creditcoin CC3 and ETH on Ethereum Sepolia.
            </small>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
