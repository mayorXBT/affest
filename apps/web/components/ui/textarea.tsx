import * as React from 'react';
import { cn } from '@/lib/utils';

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'mt-2 min-h-[92px] w-full resize-y rounded-md border border-[#354044] bg-[#101618] p-3 text-[12px] leading-relaxed text-paper',
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
