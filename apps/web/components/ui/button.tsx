import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[7px] text-xs font-extrabold transition-[background-color,border-color,color,transform] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-lime text-lime-ink hover:bg-lime/90',
        outline: 'border border-[#3e493e] bg-[#1d2820] text-lime hover:bg-[#243328]',
        ghost: 'bg-transparent text-muted hover:text-lime',
        link: 'bg-transparent text-lime hover:text-paper',
        destructive: 'border border-danger-line bg-danger-bg text-danger hover:bg-[#3a2422]',
        secondary: 'border border-[#3a4754] bg-[#202a36] text-[#b9c5ff] hover:bg-[#263140]',
        connected: 'border border-[#3b5337] bg-[#202a22] text-lime',
      },
      size: {
        default: 'h-9 px-3.5 py-2',
        sm: 'h-8 px-2.5 text-[10px]',
        lg: 'h-10 px-4',
        full: 'h-10 w-full px-3',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button';
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { Button, buttonVariants };
