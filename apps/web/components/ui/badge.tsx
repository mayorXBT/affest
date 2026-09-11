import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-[#3b4a42] bg-[#1a261d] text-[#b7c9a7]',
        preview: 'border-[#445047] text-[#9eac9f]',
        waiting: 'border-wait-line bg-wait-bg text-amber',
        muted: 'border-line text-muted',
        agent: 'border-[#3a4754] bg-[#202a36] text-[#b9c5ff]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
