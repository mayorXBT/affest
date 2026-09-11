'use client';

import { useState } from 'react';
import { Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cc3AddChainParams, creditcoinCc3 } from '@/lib/chain';
import { shortAddress } from '@/lib/format';

async function addCc3Network() {
  const provider = window.ethereum;
  if (!provider?.request) throw new Error('No injected wallet found');
  await provider.request({ method: 'wallet_addEthereumChain', params: [cc3AddChainParams] });
}

export function WalletButton() {
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const [menuOpen, setMenuOpen] = useState(false);
  const onCc3 = chainId === creditcoinCc3.id;

  async function switchToCc3() {
    try {
      await switchChainAsync({ chainId: creditcoinCc3.id });
    } catch {
      await addCc3Network();
      await switchChainAsync({ chainId: creditcoinCc3.id });
    }
  }

  async function connectWallet() {
    const connector = connectors.find((item) => item.type === 'injected') ?? connectors[0];
    if (!connector) {
      toast('Install MetaMask or another injected wallet');
      return;
    }
    try {
      await connectAsync({ connector });
      await switchToCc3();
      toast('Wallet connected to CC3 testnet');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Wallet connection failed');
    }
  }

  if (!isConnected || !address) {
    return (
      <Button onClick={() => void connectWallet()} disabled={isPending}>
        <Wallet size={16} />
        Connect wallet
      </Button>
    );
  }

  if (!onCc3) {
    return (
      <Button onClick={() => void switchToCc3()}>
        Switch to CC3
      </Button>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((value) => !value)}
        className="flex items-center gap-2 rounded-full border border-[#2b3438] bg-[#161b1e] py-1 pr-3 pl-1"
      >
        <Avatar className="size-6 bg-[#2a3530]">
          <AvatarFallback>{address.slice(2, 3).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-[13px] font-medium tracking-tight">{shortAddress(address)}</span>
      </button>
      {menuOpen ? (
        <div className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-[180px] rounded-xl border border-line bg-ink-2 p-2">
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-[12px] hover:bg-ink-3"
            onClick={() => {
              void navigator.clipboard.writeText(address);
              toast('Address copied');
              setMenuOpen(false);
            }}
          >
            Copy address
          </button>
          <button
            type="button"
            className="block w-full rounded-md px-3 py-2 text-left text-[12px] hover:bg-ink-3"
            onClick={() => {
              disconnect();
              setMenuOpen(false);
            }}
          >
            Disconnect
          </button>
        </div>
      ) : null}
    </div>
  );
}
