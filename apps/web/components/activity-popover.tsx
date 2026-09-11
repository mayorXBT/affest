'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { explorerTx, useActivity } from '@/lib/use-activity';
import { useCc3Account } from '@/lib/use-cc3';

export function ActivityPopover() {
  const { isConnected } = useCc3Account();
  const activity = useActivity();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = activity.items.slice(0, 5);

  return (
    <div ref={root} className="relative">
      <Button variant="ghost" size="icon" aria-label="Recent activity" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={15} />
      </Button>
      {open ? (
        <div role="dialog" aria-label="Recent activity" className="absolute top-[calc(100%+8px)] right-0 z-50 w-[min(360px,calc(100vw-32px))] rounded-xl border border-line bg-ink-2 p-3">
          <div className="mb-2 flex items-center justify-between px-1">
            <b className="text-[13px]">Recent activity</b>
            <Link href="/activity" className="text-[12px] text-lime" onClick={() => setOpen(false)}>See all</Link>
          </div>
          {!isConnected ? (
            <p className="m-0 px-1 py-4 text-[12px] leading-relaxed text-[#788484]">Connect a wallet to load CC3 activity.</p>
          ) : activity.loading ? (
            <p className="m-0 px-1 py-4 text-[12px] leading-relaxed text-[#788484]">Reading CC3 logs.</p>
          ) : items.length === 0 ? (
            <p className="m-0 px-1 py-4 text-[12px] leading-relaxed text-[#788484]">No on-chain activity yet for this wallet.</p>
          ) : (
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {items.map((item) => (
                <li key={`${item.hash}-${item.kind}`} className="rounded-md px-1 py-1.5">
                  <b className="block text-[12px]">{item.title}</b>
                  <small className="block text-[11px] text-[#8b9798]">{item.detail}</small>
                  <a className="text-[11px] text-lime" href={explorerTx(item.hash)} target="_blank" rel="noreferrer">View tx</a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
