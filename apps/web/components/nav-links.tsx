'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, Bot, LayoutDashboard, PieChart, Settings, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { routes } from '@/lib/routes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const icons = {
  '/': LayoutDashboard,
  '/portfolio': PieChart,
  '/strategies': SlidersHorizontal,
  '/activity': Activity,
  '/agents': Bot,
  '/settings': Settings,
};

export function NavLinks({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const pathname = usePathname();

  return (
    <nav className="grid gap-1" aria-label="Main navigation">
      {routes.map((route) => {
        const active = pathname === route.href;
        const Icon = icons[route.href];
        const link = (
          <Link
            href={route.href}
            aria-current={active ? 'page' : undefined}
            aria-label={route.label}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-[7px] px-3 py-2 text-[13px] text-[#899395] transition-colors duration-150 hover:bg-[#151b1e] hover:text-paper',
              active && 'bg-ink-3 text-paper',
              collapsed && 'justify-center px-0',
            )}
          >
            <Icon size={16} />
            {collapsed ? null : route.label}
          </Link>
        );

        if (!collapsed) return <div key={route.href}>{link}</div>;

        return (
          <Tooltip key={route.href}>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{route.label}</TooltipContent>
          </Tooltip>
        );
      })}
    </nav>
  );
}
