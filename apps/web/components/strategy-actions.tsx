'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSpotPrices } from '@/lib/prices';
import { displayName, readDraft, renameDraft, setDraftAmount } from '@/lib/strategy-drafts';

export function StrategyName({ id, className }: { id: string; className?: string }) {
  const [name, setName] = useState(`Strategy #${id}`);

  useEffect(() => {
    function refresh() {
      setName(displayName(id));
    }
    refresh();
    window.addEventListener('affest-drafts-changed', refresh);
    return () => window.removeEventListener('affest-drafts-changed', refresh);
  }, [id]);

  return <span className={className}>{name}</span>;
}

export function StrategyActions({ id }: { id: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const prices = useSpotPrices();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'rename' | 'amount'>('menu');
  const [name, setName] = useState(displayName(id));
  const [amount, setAmount] = useState(readDraft(id)?.allocatedUsd?.toString() ?? '');

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
        setMode('menu');
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  function saveName() {
    renameDraft(id, name);
    setMode('menu');
    setOpen(false);
  }

  function saveAmount() {
    const allocatedUsd = Number(amount);
    const ctcUsd = prices.data?.ctcUsd ?? 0;
    const ethUsd = prices.data?.ethUsd ?? 0;
    const tctcPct = readDraft(id)?.tctcPct ?? 50;
    setDraftAmount({ id, allocatedUsd, ctcUsd, ethUsd, tctcPct });
    setMode('menu');
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative flex items-center justify-end gap-1">
      <button
        type="button"
        className="grid size-8 place-items-center rounded-md text-[#a2acab] hover:bg-ink-3 hover:text-paper"
        aria-label="Strategy actions"
        onClick={() => {
          setName(displayName(id));
          setAmount(readDraft(id)?.allocatedUsd?.toString() ?? '');
          setOpen((value) => !value);
          setMode('menu');
        }}
      >
        <MoreHorizontal size={16} />
      </button>
      {open ? (
        <div className="absolute top-[calc(100%+6px)] right-0 z-30 w-52 rounded-xl border border-line bg-ink-2 p-1">
          {mode === 'rename' ? (
            <form
              className="p-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveName();
              }}
            >
              <input
                autoFocus
                className="h-8 w-full rounded-md border border-[#354044] bg-[#101618] px-2 text-[12px]"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <button type="submit" className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-ink-3">
                Save name
              </button>
            </form>
          ) : mode === 'amount' ? (
            <form
              className="p-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveAmount();
              }}
            >
              <input
                autoFocus
                className="h-8 w-full rounded-md border border-[#354044] bg-[#101618] px-2 text-[12px]"
                value={amount}
                placeholder="USD amount"
                inputMode="decimal"
                onChange={(event) => setAmount(event.target.value)}
              />
              <button type="submit" className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-ink-3">
                Save amount
              </button>
            </form>
          ) : (
            <>
              <Link
                href={`/strategies?edit=${id}`}
                className="block rounded-lg px-3 py-2 text-[13px] hover:bg-ink-3"
                onClick={() => setOpen(false)}
              >
                Edit canvas
              </Link>
              <button
                type="button"
                className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-ink-3"
                onClick={() => setMode('rename')}
              >
                Rename
              </button>
              <button
                type="button"
                className="flex w-full rounded-lg px-3 py-2 text-left text-[13px] hover:bg-ink-3"
                onClick={() => setMode('amount')}
              >
                Set amount
              </button>
            </>
          )}
        </div>
      ) : null}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/strategies/${id}`}>View</Link>
      </Button>
    </div>
  );
}
