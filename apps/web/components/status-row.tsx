'use client';

import { ShieldCheck } from 'lucide-react';
import { useCc3Account } from '@/lib/use-cc3';

export function StatusRow() {
  const { isConnected, onCc3 } = useCc3Account();

  return (
    <div className="mt-7 mb-3 flex flex-wrap items-center gap-4 text-[11px] tracking-wide">
      <span className="flex items-center gap-2 text-[#bbc5bf]">
        <i className="inline-block size-1.5 rounded-full bg-lime shadow-[0_0_0_3px_#d6f26a18]" />
        Creditcoin CC3 Testnet
      </span>
      <span className="flex items-center gap-1.5 text-[#9ca8a1]">
        <ShieldCheck size={14} className="text-lime" />
        {isConnected && onCc3 ? 'Wallet on CC3' : isConnected ? 'Switch to CC3' : 'Waiting for wallet'}
      </span>
      <span className="hidden text-[#677174] lg:ml-auto lg:inline">
        {isConnected && onCc3 ? 'Live RPC reads' : 'No wallet connected'}
      </span>
    </div>
  );
}
