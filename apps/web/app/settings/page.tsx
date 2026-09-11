'use client';

import { toast } from 'sonner';
import { useWriteContract } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { wagmiConfig } from '@/lib/chain';
import { cc3Contracts, strategyManagerAbi } from '@/lib/contracts';
import { useOwnedStrategy } from '@/lib/use-cc3';

export default function SettingsPage() {
  const owned = useOwnedStrategy();
  const { writeContractAsync, isPending } = useWriteContract();
  const paused = owned.strategy?.status === 1;

  async function toggle() {
    if (!owned.id) {
      toast('Create a strategy first');
      return;
    }
    const hash = await writeContractAsync({
      abi: strategyManagerAbi,
      address: cc3Contracts.strategyManager,
      functionName: paused ? 'resumeStrategy' : 'pauseStrategy',
      args: [owned.id],
    });
    await waitForTransactionReceipt(wagmiConfig, { hash });
    owned.refetch();
    toast(paused ? 'Strategy resumed on CC3' : 'Strategy paused on CC3');
  }

  return (
    <>
      <div className="mt-7 grid gap-3.5 lg:grid-cols-2">
        <Card className="p-[22px_23px]">
          <p className="eyebrow">Network</p>
          <h2 className="mt-0 mb-1 text-[17px] font-semibold">Creditcoin CC3 Testnet</h2>
          <div className="mt-3 flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
            <span>Chain ID</span>
            <code className="text-[12px] text-[#c5cfca]">102031</code>
          </div>
          <div className="flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
            <span>Source chain</span>
            <b className="text-[#c5cfca]">Ethereum Sepolia</b>
          </div>
          <div className="flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
            <span>Environment</span>
            <Badge>Testnet only</Badge>
          </div>
        </Card>
        <Card className="p-[22px_23px]">
          <p className="eyebrow">Safety</p>
          <h2 className="mt-0 mb-1 text-[17px] font-semibold">Permission boundaries</h2>
          <div className="mt-3 flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
            <span>Proof required</span>
            <b className="text-[#b9d68d]">Enabled</b>
          </div>
          <div className="flex items-center justify-between border-t border-[#2b3436] py-3 text-[12px] text-muted">
            <span>Arbitrary calldata</span>
            <b className="text-[#b9d68d]">Blocked</b>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="mt-4" disabled={isPending || !owned.id}>
                {paused ? 'Resume strategy' : 'Emergency pause strategy'}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{paused ? 'Resume strategy on CC3?' : 'Pause strategy on CC3?'}</AlertDialogTitle>
                <AlertDialogDescription>
                  This sends a transaction from your connected wallet to AffestStrategyManager.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="border border-danger-line bg-danger-bg text-danger hover:bg-[#3a2422]"
                  onClick={() => void toggle()}
                >
                  Confirm
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Card>
      </div>
      <Card className="mt-3.5 flex items-start gap-3 p-[22px_23px]">
        <span className="grid size-7 place-items-center rounded-md bg-[#8b9bff18] text-blue">!</span>
        <div>
          <b>Testnet workspace</b>
          <p className="mt-1 mb-0 text-[12px] leading-relaxed text-[#879293]">
            Affest reads live CC3 balances from your wallet. It never asks for a private key. Strategy execution still requires a verified Attestcoin proof.
          </p>
        </div>
      </Card>
    </>
  );
}
