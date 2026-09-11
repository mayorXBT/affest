'use client';

import { Toaster as Sonner } from 'sonner';

function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: 'border border-[#45533f] bg-[#1b281f] text-[#d4e5c5] font-mono text-[11px]',
        },
      }}
    />
  );
}

export { Toaster };
