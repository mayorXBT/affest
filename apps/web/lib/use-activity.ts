'use client';

import { useQuery } from '@tanstack/react-query';
import { type Address, type Hash, formatUnits, parseAbiItem } from 'viem';
import { usePublicClient } from 'wagmi';
import { creditcoinCc3 } from '@/lib/chain';
import { cc3Contracts, cc3StartBlock } from '@/lib/contracts';
import { useCc3Holdings } from '@/lib/use-cc3';

const vaultCreatedEvent = parseAbiItem('event VaultCreated(address indexed owner, address indexed vault)');
const strategyCreatedEvent = parseAbiItem('event StrategyCreated(uint256 indexed strategyId, address indexed owner, address indexed vault, uint8 mode)');
const wrapDepositEvent = parseAbiItem('event Deposit(address indexed dst, uint256 wad)');
const wrapWithdrawEvent = parseAbiItem('event Withdrawal(address indexed src, uint256 wad)');
const vaultDepositEvent = parseAbiItem('event Deposit(address indexed sender, address indexed asset, uint256 amount)');
const vaultWithdrawEvent = parseAbiItem('event Withdrawal(address indexed asset, uint256 amount)');

export type ActivityItem = {
  kind: 'wrap' | 'unwrap' | 'vault-created' | 'vault-deposit' | 'vault-withdraw' | 'strategy-created';
  hash: Hash;
  blockNumber: bigint;
  at: number;
  title: string;
  detail: string;
};

function formatTctc(value: bigint) {
  const n = Number(formatUnits(value, 18));
  if (!Number.isFinite(n)) return formatUnits(value, 18);
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 4 })} TCTC`;
}

export function useActivity() {
  const holdings = useCc3Holdings();
  const client = usePublicClient({ chainId: creditcoinCc3.id });
  const address = holdings.address;
  const vaultAddress = holdings.vaultAddress;
  const wrapper = holdings.wrapper;

  const query = useQuery({
    queryKey: ['cc3-activity', address, vaultAddress, wrapper],
    enabled: Boolean(client && address),
    queryFn: async (): Promise<ActivityItem[]> => {
      if (!client || !address) return [];
      const items: ActivityItem[] = [];

      const [vaultCreated, strategyCreated, wraps, unwraps, deposits, withdrawals] = await Promise.all([
        client.getLogs({
          address: cc3Contracts.vaultFactory,
          event: vaultCreatedEvent,
          args: { owner: address },
          fromBlock: cc3StartBlock,
          toBlock: 'latest',
        }),
        client.getLogs({
          address: cc3Contracts.strategyManager,
          event: strategyCreatedEvent,
          args: { owner: address },
          fromBlock: cc3StartBlock,
          toBlock: 'latest',
        }),
        wrapper
          ? client.getLogs({
              address: wrapper,
              event: wrapDepositEvent,
              args: { dst: address },
              fromBlock: cc3StartBlock,
              toBlock: 'latest',
            })
          : Promise.resolve([]),
        wrapper
          ? client.getLogs({
              address: wrapper,
              event: wrapWithdrawEvent,
              args: { src: address },
              fromBlock: cc3StartBlock,
              toBlock: 'latest',
            })
          : Promise.resolve([]),
        vaultAddress
          ? client.getLogs({
              address: vaultAddress,
              event: vaultDepositEvent,
              args: { sender: address },
              fromBlock: cc3StartBlock,
              toBlock: 'latest',
            })
          : Promise.resolve([]),
        vaultAddress
          ? client.getLogs({
              address: vaultAddress,
              event: vaultWithdrawEvent,
              fromBlock: cc3StartBlock,
              toBlock: 'latest',
            })
          : Promise.resolve([]),
      ]);

      for (const log of vaultCreated) {
        items.push({
          kind: 'vault-created',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'Vault created',
          detail: 'Affest vault deployed on Creditcoin CC3',
        });
      }
      for (const log of strategyCreated) {
        items.push({
          kind: 'strategy-created',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'Strategy created',
          detail: `Strategy #${log.args.strategyId?.toString() ?? '—'}`,
        });
      }
      for (const log of wraps) {
        items.push({
          kind: 'wrap',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'TCTC wrapped',
          detail: formatTctc(log.args.wad ?? 0n),
        });
      }
      for (const log of unwraps) {
        items.push({
          kind: 'unwrap',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'WTCTC unwrapped',
          detail: formatTctc(log.args.wad ?? 0n),
        });
      }
      for (const log of deposits) {
        items.push({
          kind: 'vault-deposit',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'Vault deposit',
          detail: formatTctc(log.args.amount ?? 0n),
        });
      }
      for (const log of withdrawals) {
        items.push({
          kind: 'vault-withdraw',
          hash: log.transactionHash,
          blockNumber: log.blockNumber,
          at: 0,
          title: 'Vault withdrawal',
          detail: formatTctc(log.args.amount ?? 0n),
        });
      }

      const blocks = [...new Set(items.map((item) => item.blockNumber.toString()))];
      const timestamps = new Map<string, number>();
      await Promise.all(blocks.map(async (key) => {
        const block = await client.getBlock({ blockNumber: BigInt(key) });
        timestamps.set(key, Number(block.timestamp) * 1000);
      }));
      for (const item of items) {
        item.at = timestamps.get(item.blockNumber.toString()) ?? 0;
      }
      items.sort((left, right) => right.at - left.at || Number(right.blockNumber - left.blockNumber));
      return items;
    },
  });

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

export function explorerTx(hash: Hash) {
  return `${creditcoinCc3.blockExplorers.default.url}/tx/${hash}`;
}
