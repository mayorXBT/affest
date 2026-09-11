import * as React from 'react';
import { cn } from '@/lib/utils';

function Alert({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-3 rounded-[9px] border border-line-strong bg-preview-bg px-4 py-3.5',
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('text-[12px] font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('m-0 mt-1 text-[12px] leading-relaxed text-[#9da89d]', className)} {...props} />;
}

export { Alert, AlertTitle, AlertDescription };
