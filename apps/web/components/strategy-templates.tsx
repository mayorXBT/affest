'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AssetLogo } from '@/components/asset-logo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StrategyActions, StrategyName } from '@/components/strategy-actions';
import { listDrafts, type StrategyDraft } from '@/lib/strategy-drafts';
import { strategyTemplates } from '@/lib/strategy-templates';
import { useCreateStrategy } from '@/lib/use-create-strategy';
import { useOwnedStrategies } from '@/lib/use-cc3';

export function StrategyTemplates() {
  const owned = useOwnedStrategies();
  const { create, isPending, connected } = useCreateStrategy();
  const [drafts, setDrafts] = useState<StrategyDraft[]>([]);

  useEffect(() => {
    function refresh() {
      setDrafts(listDrafts());
    }
    refresh();
    window.addEventListener('affest-drafts-changed', refresh);
    return () => window.removeEventListener('affest-drafts-changed', refresh);
  }, []);

  async function useTemplate(tctcPct: number, name: string) {
    if (!connected) {
      toast('Connect a wallet first');
      return;
    }
    try {
      await create({ tctcPct });
      owned.refetch();
      toast(`${name} is on CC3. Open it from My strategies.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not set template');
    }
  }

  return (
    <Card className="p-[22px_23px]">
      <CardHeader>
        <div>
          <p className="eyebrow">Templates</p>
          <CardTitle>Use a ready mix</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mt-1 mb-4 text-[12px] leading-relaxed text-[#8f9a9b]">
          Created strategies keep a canvas draft you can edit. Ready mixes still set a TCTC/ETH allocation in one signature.
        </p>
        {drafts.length > 0 ? (
          <ul className="m-0 mb-4 flex list-none flex-col gap-3 p-0">
            {drafts.map((draft) => (
              <li key={draft.id} className="rounded-lg border border-[#2b3436] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <b className="text-[13px]"><StrategyName id={draft.id} /></b>
                    <small className="mt-1 block text-[11px] text-[#788484]">{draft.detail || `Saved canvas for strategy #${draft.id}`}</small>
                  </div>
                  <StrategyActions id={draft.id} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {strategyTemplates.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#2b3436] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-1.5">
                    <AssetLogo kind="TCTC" size={16} />
                    <AssetLogo kind="ETH" size={16} />
                    <b className="text-[13px]">{item.name}</b>
                  </div>
                  <small className="mt-1 block text-[11px] text-[#788484]">{item.detail}</small>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#2a3438]">
                    <div className="flex h-full">
                      <span className="h-full bg-[#9b7fe6]" style={{ width: `${item.tctcPct}%` }} />
                      <span className="h-full bg-[#7f92e6]" style={{ width: `${100 - item.tctcPct}%` }} />
                    </div>
                  </div>
                  <small className="mt-1 block text-[11px] text-[#6f7c7d]">{item.tctcPct}% TCTC · {100 - item.tctcPct}% ETH</small>
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <Button size="sm" disabled={isPending} onClick={() => void useTemplate(item.tctcPct, item.name)}>
                    Use
                  </Button>
                  <Button size="sm" variant="link" asChild>
                    <Link href={`/strategies?template=${item.id}`}>Edit</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
