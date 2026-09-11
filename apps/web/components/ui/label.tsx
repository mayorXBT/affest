'use client';

import * as React from 'react';
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '@/lib/utils';

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn('block font-mono text-[11px] uppercase tracking-[0.12em] text-[#aab4b1]', className)}
      {...props}
    />
  );
}

export { Label };
