'use client';

import { useState } from 'react';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { NavLinks } from '@/components/nav-links';
import { NetworkChip } from '@/components/network-chip';

export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation">
          <Menu size={16} />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Navigate</SheetTitle>
        </SheetHeader>
        <div className="mb-3 flex items-center gap-2.5 px-1 text-xl font-extrabold tracking-[-0.04em]">
          <span className="grid size-[23px] rotate-45 place-items-center rounded-[7px_2px_7px_2px] border-2 border-lime">
            <span className="size-1.5 rounded-full bg-lime" />
          </span>
          Affest
        </div>
        <NetworkChip />
        <NavLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
