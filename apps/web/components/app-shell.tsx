'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CircleHelp, Lock, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ActivityPopover } from '@/components/activity-popover';
import { MobileNav } from '@/components/mobile-nav';
import { NavLinks } from '@/components/nav-links';
import { NetworkChip } from '@/components/network-chip';
import { WalletButton } from '@/components/wallet-button';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { copyForPath } from '@/lib/routes';
import { shortAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAccount } from 'wagmi';

const SIDEBAR_KEY = 'affest.sidebar-collapsed';

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const copy = copyForPath(pathname);
  const { address, isConnected } = useAccount();
  const [collapsed, setCollapsed] = useState(false);
  const isDocs = pathname.startsWith('/docs');

  useEffect(() => {
    setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === '1');
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      return next;
    });
  }

  if (isDocs) return <>{children}</>;

  return (
    <div className="flex min-h-screen bg-ink text-paper">
      <aside
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col overflow-hidden border-r border-[#20272a] bg-ink-sidebar px-3 py-5 lg:flex',
          collapsed ? 'w-[72px]' : 'w-60',
        )}
      >
        <div className={cn('mb-4 flex items-center', collapsed ? 'justify-center' : 'justify-between px-1')}>
          <div className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-0.04em]">
            <span className="grid size-[23px] rotate-45 place-items-center rounded-[7px_2px_7px_2px] border-2 border-lime">
              <span className="size-1.5 rounded-full bg-lime" />
            </span>
            {collapsed ? null : 'Affest'}
          </div>
          {collapsed ? null : (
            <Button variant="ghost" size="icon" aria-label="Collapse sidebar" onClick={toggleSidebar}>
              <PanelLeftClose size={16} />
            </Button>
          )}
        </div>
        {collapsed ? (
          <Button variant="ghost" size="icon" className="mb-4 self-center" aria-label="Expand sidebar" onClick={toggleSidebar}>
            <PanelLeftOpen size={16} />
          </Button>
        ) : null}
        <NetworkChip compact={collapsed} />
        <NavLinks collapsed={collapsed} />
        <div className="mt-auto min-h-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-[#758082]">
                    <Lock size={15} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="right">Non-custodial by design</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link href="/settings" className="text-[#758082] hover:text-paper" aria-label="Read the safety guide">
                    <CircleHelp size={15} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">Read the safety guide</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-[#758082]">
                <Lock size={15} />
                Non-custodial by design
              </div>
              <Link href="/settings" className="flex items-center gap-2 px-3 py-1.5 text-[12px] text-[#758082] hover:text-paper">
                <CircleHelp size={15} />
                Read the safety guide
              </Link>
              <Separator className="mt-3" />
              <div className="flex items-center gap-2.5 px-2 pt-3 text-[12px]">
                <Avatar>
                  <AvatarFallback>{address ? address.slice(2, 3).toUpperCase() : 'A'}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <b className="block font-semibold">{isConnected && address ? shortAddress(address) : 'Testnet wallet'}</b>
                  <small className="mt-0.5 block text-[11px] text-[#657072]">
                    {isConnected ? 'Connected on CC3' : 'Not connected'}
                  </small>
                </span>
              </div>
            </>
          )}
        </div>
      </aside>

      <section className="mx-auto flex min-h-screen w-full max-w-[1360px] flex-col px-4 py-5 sm:px-6 lg:px-10 xl:px-12">
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[#20282a] pb-4">
          <div className="flex items-start gap-3">
            <MobileNav />
            <div>
              <h1 className="m-0 text-[22px] font-semibold tracking-[-0.05em] lg:text-[28px]">{copy?.title}</h1>
              <p className="mt-1.5 mb-0 text-[12px] text-[#778384]">{copy?.subtitle}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ActivityPopover />
            <WalletButton />
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <footer className="mt-6 flex flex-col justify-between gap-2 border-t border-[#20282a] pt-4 font-mono text-[11px] text-muted-2 lg:flex-row">
          <span>Affest · verified cross-chain automation</span>
          <span className="flex flex-wrap gap-4">
            <Link href="/docs" className="hover:text-paper">Docs</Link>
            <Link href="/docs/security" className="hover:text-paper">Security</Link>
            <Link href="/docs/testnet" className="hover:text-paper">Testnet notes</Link>
          </span>
        </footer>
      </section>
    </div>
  );
}
