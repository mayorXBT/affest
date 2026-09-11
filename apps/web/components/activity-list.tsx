'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { explorerTx, useActivity, type ActivityItem } from '@/lib/use-activity';
import { useCc3Account } from '@/lib/use-cc3';

function Empty({ copy }: { copy: string }) {
  return (
    <div className="py-6">
      <b className="block text-[13px]">{copy}</b>
      <small className="mt-1 block text-[12px] leading-relaxed text-[#788484]">
        Activity is read from Creditcoin CC3 logs for this wallet.
      </small>
    </div>
  );
}

function ActivityRows({ items }: { items: readonly ActivityItem[] }) {
  if (items.length === 0) return <Empty copy="No activity yet" />;
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item) => (
        <li key={`${item.hash}-${item.kind}`} className="flex items-start justify-between gap-3 border-b border-[#2b3436] pb-3 last:border-b-0 last:pb-0">
          <div>
            <b className="block text-[13px]">{item.title}</b>
            <small className="mt-1 block text-[12px] text-[#8b9798]">{item.detail}</small>
            {item.at > 0 ? (
              <small className="mt-1 block text-[11px] text-[#667274]">{new Date(item.at).toLocaleString()}</small>
            ) : null}
          </div>
          <a className="shrink-0 text-[11px] text-lime" href={explorerTx(item.hash)} target="_blank" rel="noreferrer">
            Tx
          </a>
        </li>
      ))}
    </ul>
  );
}

export function ActivityList({ compact = false }: { compact?: boolean }) {
  const { isConnected } = useCc3Account();
  const activity = useActivity();
  const items = activity.items;
  const proofs = items.filter((item) => item.kind === 'strategy-created' || item.kind === 'vault-created');
  const actions = items.filter((item) => item.kind === 'wrap' || item.kind === 'unwrap' || item.kind === 'vault-deposit' || item.kind === 'vault-withdraw');

  if (compact) {
    return (
      <Card className="min-h-[216px] p-[22px_23px]">
        <CardHeader>
          <div>
            <p className="eyebrow">Activity</p>
            <CardTitle>Recent movement</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/activity">
              See all <ChevronRight size={14} />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="mt-3">
          {!isConnected ? <Empty copy="Connect a wallet" /> : activity.loading ? <Empty copy="Reading CC3 logs" /> : <ActivityRows items={items.slice(0, 4)} />}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mt-7">
      <Tabs defaultValue="all">
        <div className="mb-3.5 flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="all">All activity</TabsTrigger>
            <TabsTrigger value="proof">Proofs</TabsTrigger>
            <TabsTrigger value="action">Actions</TabsTrigger>
          </TabsList>
          <span className="rounded-sm border border-[#3b4a42] bg-[#1a261d] px-1.5 py-1 text-[11px] text-[#b7c9a7]">
            Testnet timeline
          </span>
        </div>
        <Card className="min-h-[270px] p-[22px_23px]">
          {!isConnected ? (
            <Empty copy="Connect a wallet" />
          ) : activity.loading ? (
            <Empty copy="Reading CC3 logs" />
          ) : (
            <>
              <TabsContent value="all"><ActivityRows items={items} /></TabsContent>
              <TabsContent value="proof"><ActivityRows items={proofs} /></TabsContent>
              <TabsContent value="action"><ActivityRows items={actions} /></TabsContent>
            </>
          )}
        </Card>
      </Tabs>
    </div>
  );
}
