'use client';

import { useEffect, useState } from 'react';
import { formatUnits, type Address } from 'viem';
import { getBytecode, readContract } from 'wagmi/actions';
import { Badge } from '@/components/ui/badge';
import { erc20Abi, vaultAbi } from '@/lib/contracts';
import { creditcoinCc3, wagmiConfig } from '@/lib/chain';

type StrategyLike = {
  readonly status: number;
  readonly owner: Address;
  readonly vault: Address;
  readonly stableAsset: Address;
  readonly riskAsset: Address;
  readonly stableWeightBps: number;
  readonly riskWeightBps: number;
};

type Readiness = {
  readonly label: 'Ready' | 'Balanced' | 'Unfunded' | 'Misconfigured' | 'Paused' | 'Unavailable';
  readonly detail: string;
  readonly stable?: string;
  readonly risk?: string;
};

const empty = (label: Readiness['label'], detail: string): Readiness => ({ label, detail });

export function StrategyReadiness({ strategy }: { strategy: StrategyLike }) {
  const [readiness, setReadiness] = useState<Readiness>(empty('Unavailable', 'Reading vault diagnostics…'));

  useEffect(() => {
    let cancelled = false;
    async function read() {
      if (strategy.status === 1) {
        setReadiness(empty('Paused', 'Strategy is paused on-chain.'));
        return;
      }
      try {
        const [vaultCode, owner, vaultStable, vaultRisk] = await Promise.all([
          getBytecode(wagmiConfig, { address: strategy.vault, chainId: creditcoinCc3.id }),
          readContract(wagmiConfig, { abi: vaultAbi, address: strategy.vault, functionName: 'owner', chainId: creditcoinCc3.id }),
          readContract(wagmiConfig, { abi: vaultAbi, address: strategy.vault, functionName: 'stableAsset', chainId: creditcoinCc3.id }),
          readContract(wagmiConfig, { abi: vaultAbi, address: strategy.vault, functionName: 'riskAsset', chainId: creditcoinCc3.id }),
        ]);
        if (!vaultCode || vaultCode === '0x') {
          if (!cancelled) setReadiness(empty('Misconfigured', 'Vault has no contract code on Creditcoin CC3.'));
          return;
        }
        if (vaultStable.toLowerCase() !== strategy.stableAsset.toLowerCase() || vaultRisk.toLowerCase() !== strategy.riskAsset.toLowerCase()) {
          if (!cancelled) setReadiness(empty('Misconfigured', 'Vault token configuration does not match this strategy.'));
          return;
        }
        if (owner.toLowerCase() !== strategy.owner.toLowerCase()) {
          if (!cancelled) setReadiness(empty('Misconfigured', 'Vault owner could not be matched to this strategy.'));
          return;
        }
        async function token(token: Address) {
          const code = await getBytecode(wagmiConfig, { address: token, chainId: creditcoinCc3.id });
          if (!code || code === '0x') return { ok: false as const, raw: 0n, formatted: '0', reason: `${token} has no CC3 contract code.` };
          const [balance, decimals, symbol] = await Promise.all([
            readContract(wagmiConfig, { abi: erc20Abi, address: token, functionName: 'balanceOf', args: [strategy.vault], chainId: creditcoinCc3.id }),
            readContract(wagmiConfig, { abi: erc20Abi, address: token, functionName: 'decimals', chainId: creditcoinCc3.id }),
            readContract(wagmiConfig, { abi: erc20Abi, address: token, functionName: 'symbol', chainId: creditcoinCc3.id }),
          ]);
          return { ok: true as const, raw: balance, formatted: formatUnits(balance, decimals), symbol };
        }
        const [stable, risk] = await Promise.all([token(strategy.stableAsset), token(strategy.riskAsset)]);
        if (!stable.ok || !risk.ok) {
          if (!cancelled) setReadiness(empty('Misconfigured', !stable.ok ? `Stable token ${stable.reason}` : `Risk token ${risk.reason}`));
          return;
        }
        if (stable.raw === 0n && risk.raw === 0n) {
          if (!cancelled) setReadiness({ label: 'Unfunded', detail: 'Deposit WTCTC or DEMO_RISK into this vault on CC3.', stable: `${stable.formatted} ${stable.symbol}`, risk: `${risk.formatted} ${risk.symbol}` });
          return;
        }
        const total = stable.raw + risk.raw;
        const balanced = stable.raw * 10_000n === total * BigInt(strategy.stableWeightBps);
        if (balanced) {
          if (!cancelled) setReadiness({ label: 'Balanced', detail: 'Vault is funded and already matches the target allocation.', stable: `${stable.formatted} ${stable.symbol}`, risk: `${risk.formatted} ${risk.symbol}` });
          return;
        }
        if (!cancelled) setReadiness({ label: 'Ready', detail: 'Vault is funded and can be checked for a verified trigger.', stable: `${stable.formatted} ${stable.symbol}`, risk: `${risk.formatted} ${risk.symbol}` });
      } catch (error: unknown) {
        if (!cancelled) setReadiness(empty('Unavailable', error instanceof Error ? error.message : 'Could not read CC3 vault diagnostics.'));
      }
    }
    void read();
    return () => { cancelled = true; };
  }, [strategy.riskAsset, strategy.stableAsset, strategy.status, strategy.vault]);

  const variant = readiness.label === 'Ready' ? 'default' : readiness.label === 'Misconfigured' ? 'preview' : readiness.label === 'Paused' ? 'waiting' : 'muted';
  return (
    <div className="min-w-0">
      <Badge variant={variant}>{readiness.label}</Badge>
      <small className="mt-1 block max-w-[230px] truncate text-[11px] text-[#788484]" title={readiness.detail}>{readiness.detail}</small>
      {readiness.stable || readiness.risk ? <small className="mt-1 block truncate text-[10px] text-[#657173]">{readiness.stable} · {readiness.risk}</small> : null}
    </div>
  );
}
