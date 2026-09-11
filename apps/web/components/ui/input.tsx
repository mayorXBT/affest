import * as React from 'react';
import { cn } from '@/lib/utils';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-md border border-[#354044] bg-[#101618] px-3 py-2 text-[12px] text-paper',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
