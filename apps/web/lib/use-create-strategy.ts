'use client';

import { decodeEventLog, parseUnits } from 'viem';
import { useSwitchChain, useWalletClient, useWriteContract } from 'wagmi';
import { getBytecode, readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { vaultBytecode, wrappedNativeBytecode } from '@/lib/bytecode';
import { cc3AddChainParams, creditcoinCc3, wagmiConfig } from '@/lib/chain';
import { cc3Contracts, legacyDemoTokens, sepoliaContracts, strategyManagerAbi, vaultAbi, vaultFactoryAbi, wrappedNativeAbi } from '@/lib/contracts';
import { useCc3Holdings } from '@/lib/use-cc3';
import { ensureCc3Vault, ensureWrappedTctc, type VaultDeployers } from '@/lib/vault-setup';

export function useCreateStrategy() {
  const holdings = useCc3Holdings();
  const { writeContractAsync, isPending } = useWriteContract();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();

  function deployers(): VaultDeployers {
    if (!walletClient) throw new Error('Connect a wallet first');
    return {
      deployWrapper: () => walletClient.deployContract({
        abi: wrappedNativeAbi,
        bytecode: wrappedNativeBytecode,
      }),
      deployVault: (args) => walletClient.deployContract({
        abi: vaultAbi,
        bytecode: vaultBytecode,
        args,
      }),
    };
  }

  async function create(input: {
    tctcPct: number;
    trigger?: 'TCTC' | 'ETH';
    minimum?: string;
  }) {
    if (!holdings.isConnected || !holdings.address) {
      throw new Error('Connect a wallet first');
    }
    const tctcBps = input.tctcPct * 100;
    const ethBps = 10_000 - tctcBps;
    const minimum = input.minimum && Number(input.minimum) > 0 ? input.minimum : '1';
    try {
      await switchChainAsync({ chainId: creditcoinCc3.id });
    } catch {
      const provider = window.ethereum;
      if (!provider?.request) throw new Error('No injected wallet found');
      await provider.request({ method: 'wallet_addEthereumChain', params: [cc3AddChainParams] });
      await switchChainAsync({ chainId: creditcoinCc3.id });
    }
    const wrapper = await ensureWrappedTctc(deployers());
    holdings.rememberWrapper(wrapper);
    // This is a Creditcoin-side demo token. The Sepolia WETH address is only
    // valid as the source-chain trigger asset and must never be used in CC3
    // vault/strategy asset slots.
    const riskAsset = legacyDemoTokens.risk;
    const riskCode = await getBytecode(wagmiConfig, { address: riskAsset, chainId: creditcoinCc3.id });
    if (!riskCode || riskCode === '0x') {
      throw new Error(`Risk asset ${riskAsset} is not deployed on Creditcoin CC3. Choose the configured CC3 strategy asset.`);
    }
    const vault = await ensureCc3Vault({
      owner: holdings.address,
      wrapper,
      riskAsset,
      deployers: deployers(),
      createVault: (stable) => writeContractAsync({
        abi: vaultFactoryAbi,
        address: cc3Contracts.vaultFactory,
        functionName: 'createVault',
        args: [stable, riskAsset, cc3Contracts.swapAdapter],
      }),
    });
    const [vaultCode, vaultOwner, vaultStableAsset, vaultRiskAsset] = await Promise.all([
      getBytecode(wagmiConfig, { address: vault, chainId: creditcoinCc3.id }),
      readContract(wagmiConfig, { abi: vaultAbi, address: vault, functionName: 'owner', chainId: creditcoinCc3.id }),
      readContract(wagmiConfig, { abi: vaultAbi, address: vault, functionName: 'stableAsset', chainId: creditcoinCc3.id }),
      readContract(wagmiConfig, { abi: vaultAbi, address: vault, functionName: 'riskAsset', chainId: creditcoinCc3.id }),
    ]);
    if (!vaultCode || vaultCode === '0x') throw new Error('Vault has no contract code on Creditcoin CC3. Strategy creation blocked.');
    if (vaultOwner.toLowerCase() !== holdings.address.toLowerCase()) throw new Error('Vault owner does not match the connected wallet. Strategy creation blocked.');
    if (vaultStableAsset.toLowerCase() !== wrapper.toLowerCase() || vaultRiskAsset.toLowerCase() !== riskAsset.toLowerCase()) throw new Error('Vault token configuration does not match the strategy assets. Strategy creation blocked.');
    holdings.rememberVault(vault);
    const hash = await writeContractAsync({
      abi: strategyManagerAbi,
      address: cc3Contracts.strategyManager,
      functionName: 'createStrategy',
      args: [{
        vault,
        stableAsset: wrapper,
        riskAsset,
        triggerAsset: input.trigger === 'TCTC' ? wrapper : sepoliaContracts.weth,
        minimumTriggerAmount: parseUnits(minimum, 18),
        signalType: 1,
        stableWeightBps: tctcBps,
        riskWeightBps: ethBps,
        mode: 2,
        automaticExecutionLimit: parseUnits('100', 18),
        maximumActionAmount: parseUnits('500', 18),
        maximumWeeklyAmount: parseUnits('1500', 18),
        maximumSlippageBps: 100,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365),
        cooldownSeconds: 0n,
      }],
    });
    const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
    let strategyId: bigint | undefined;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: strategyManagerAbi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'StrategyCreated') {
          strategyId = decoded.args.strategyId;
          break;
        }
      } catch {
        continue;
      }
    }
    if (strategyId === undefined) {
      strategyId = await readContract(wagmiConfig, {
        abi: strategyManagerAbi,
        address: cc3Contracts.strategyManager,
        functionName: 'strategyCount',
        chainId: creditcoinCc3.id,
      });
    }
    return { hash, strategyId: strategyId.toString() };
  }

  return { create, isPending, connected: holdings.isConnected };
}
