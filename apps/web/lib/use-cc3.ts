'use client';

import { useEffect, useMemo, useState } from 'react';
import { type Address, erc20Abi, formatUnits, zeroAddress } from 'viem';
import { useAccount, useBalance, useReadContract, useReadContracts } from 'wagmi';
import { creditcoinCc3, sepolia } from '@/lib/chain';
import { cc3Contracts, sepoliaContracts, strategyManagerAbi, vaultAbi, vaultFactoryAbi } from '@/lib/contracts';
import { WRAPPER_KEY, readStoredAddress, storeAddress, vaultStorageKey } from '@/lib/vault-setup';

export function useCc3Account() {
  const account = useAccount();
  const onCc3 = account.chainId === creditcoinCc3.id;
  const onSepolia = account.chainId === sepolia.id;
  return { ...account, onCc3, onSepolia };
}

export function useCc3Holdings() {
  const { address, isConnected, onCc3, onSepolia } = useCc3Account();
  const [storedWrapper, setStoredWrapper] = useState<Address | undefined>();
  const [sidecarVault, setSidecarVault] = useState<Address | undefined>();

  useEffect(() => {
    setStoredWrapper(readStoredAddress(WRAPPER_KEY));
    if (address) setSidecarVault(readStoredAddress(vaultStorageKey(address)));
  }, [address]);

  const tctc = useBalance({ address, chainId: creditcoinCc3.id, query: { enabled: Boolean(address) } });
  const eth = useBalance({ address, chainId: sepolia.id, query: { enabled: Boolean(address) } });
  const weth = useReadContract({
    abi: erc20Abi,
    address: sepoliaContracts.weth,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sepolia.id,
    query: { enabled: Boolean(address) },
  });

  const factoryVault = useReadContract({
    abi: vaultFactoryAbi,
    address: cc3Contracts.vaultFactory,
    functionName: 'vaultOf',
    args: address ? [address] : undefined,
    chainId: creditcoinCc3.id,
    query: { enabled: Boolean(address) },
  });

  const factoryVaultAddress = factoryVault.data && factoryVault.data !== zeroAddress ? factoryVault.data : undefined;
  // The factory vault is the wallet's canonical vault. A sidecar can exist
  // from an older strategy, but it must not hide funds in the canonical vault.
  const vaultAddress = factoryVaultAddress ?? sidecarVault;

  const vaultNative = useBalance({
    address: vaultAddress,
    chainId: creditcoinCc3.id,
    query: { enabled: Boolean(vaultAddress) },
  });

  const vaultMeta = useReadContracts({
    allowFailure: true,
    query: { enabled: Boolean(vaultAddress) },
    contracts: vaultAddress
      ? [
          { abi: vaultAbi, address: vaultAddress, functionName: 'stableAsset', chainId: creditcoinCc3.id },
          { abi: vaultAbi, address: vaultAddress, functionName: 'riskAsset', chainId: creditcoinCc3.id },
        ]
      : [],
  });

  const vaultStable = vaultMeta.data?.[0]?.status === 'success' ? vaultMeta.data[0].result : undefined;
  const wrapper = vaultStable && vaultStable !== zeroAddress ? vaultStable : storedWrapper;
  const riskAsset = vaultMeta.data?.[1]?.status === 'success' ? vaultMeta.data[1].result : undefined;

  useEffect(() => {
    if (wrapper) storeAddress(WRAPPER_KEY, wrapper);
    if (address && vaultAddress) storeAddress(vaultStorageKey(address), vaultAddress);
  }, [address, vaultAddress, wrapper]);

  const wrappedWallet = useReadContract({
    abi: erc20Abi,
    address: wrapper,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: creditcoinCc3.id,
    query: { enabled: Boolean(address && wrapper) },
  });

  const wrappedVault = useReadContract({
    abi: erc20Abi,
    address: wrapper,
    functionName: 'balanceOf',
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: creditcoinCc3.id,
    query: { enabled: Boolean(wrapper && vaultAddress) },
  });

  const riskVault = useReadContract({
    abi: erc20Abi,
    address: riskAsset,
    functionName: 'balanceOf',
    args: vaultAddress ? [vaultAddress] : undefined,
    chainId: creditcoinCc3.id,
    query: { enabled: Boolean(riskAsset && vaultAddress) },
  });

  const vaultTctc = (vaultNative.data?.value ?? 0n) + (wrappedVault.data ?? 0n);
  const wrappedTctc = wrappedWallet.data ?? 0n;

  return {
    address,
    isConnected,
    onCc3,
    onSepolia,
    tctc: tctc.data?.value ?? 0n,
    eth: eth.data?.value ?? 0n,
    ethLoading: eth.isLoading || eth.isFetching,
    ethError: eth.isError,
    weth: weth.data ?? 0n,
    wrappedTctc,
    vaultTctc,
    riskAsset,
    vaultRisk: riskVault.data ?? 0n,
    vaultAddress,
    wrapper,
    pendingVaultDeposit: wrappedTctc > 0n && Boolean(vaultAddress),
    rememberWrapper: setStoredWrapper,
    rememberVault: setSidecarVault,
    loading: tctc.isLoading || eth.isLoading,
    refetch: () => {
      void tctc.refetch();
      void eth.refetch();
      void weth.refetch();
      void factoryVault.refetch();
      void vaultNative.refetch();
      void vaultMeta.refetch();
      void wrappedWallet.refetch();
      void wrappedVault.refetch();
      void riskVault.refetch();
      if (address) setSidecarVault(readStoredAddress(vaultStorageKey(address)));
      setStoredWrapper(readStoredAddress(WRAPPER_KEY));
    },
  };
}

export function useOwnedStrategies() {
  const { address } = useCc3Account();
  const count = useReadContract({
    abi: strategyManagerAbi,
    address: cc3Contracts.strategyManager,
    functionName: 'strategyCount',
    chainId: creditcoinCc3.id,
  });
  const total = Number(count.data ?? 0n);
  const ids = useMemo(() => Array.from({ length: Math.min(total, 32) }, (_, index) => BigInt(total - index)), [total]);
  const strategies = useReadContracts({
    allowFailure: true,
    query: { enabled: total > 0 && Boolean(address) },
    contracts: ids.map((id) => ({
      abi: strategyManagerAbi,
      address: cc3Contracts.strategyManager,
      functionName: 'getStrategy' as const,
      args: [id] as const,
      chainId: creditcoinCc3.id,
    })),
  });

  const items = (strategies.data ?? [])
    .map((entry, index) => ({ id: ids[index], strategy: entry.result }))
    .filter((entry): entry is { id: bigint; strategy: NonNullable<(typeof entry)['strategy']> } =>
      Boolean(entry.id !== undefined && entry.strategy && address && entry.strategy.owner.toLowerCase() === address.toLowerCase() && entry.strategy.status !== 2),
    );

  return {
    items,
    loading: count.isLoading || strategies.isLoading,
    refetch: () => {
      void count.refetch();
      void strategies.refetch();
    },
  };
}

export function useOwnedStrategy() {
  const all = useOwnedStrategies();
  const first = all.items[0];
  return {
    id: first?.id,
    strategy: first?.strategy,
    loading: all.loading,
    refetch: all.refetch,
  };
}

export function formatAmount(value: bigint, decimals = 18) {
  const n = Number(formatUnits(value, decimals));
  if (!Number.isFinite(n)) return formatUnits(value, decimals);
  if (n === 0) return '0';
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}
