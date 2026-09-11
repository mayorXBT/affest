import { createPublicClient, defineChain, formatEther, http, isAddress, type Address } from 'viem';
import { sepolia } from 'viem/chains';

const cc3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Testnet CTC', symbol: 'TCTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
});

const contracts = {
  strategyManager: '0xf016A45345857aeE7e93C987B4429840B779020B' as Address,
  vaultFactory: '0x6A83bC86a1cF17b7F5a22d96e6aF376402491749' as Address,
};

const vaultFactoryAbi = [
  { type: 'function', name: 'vaultOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const vaultAbi = [
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

const strategyManagerAbi = [
  { type: 'function', name: 'strategyCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'getStrategy', stateMutability: 'view', inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [{
    type: 'tuple',
    components: [
      { name: 'owner', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'stableAsset', type: 'address' },
      { name: 'riskAsset', type: 'address' },
      { name: 'triggerAsset', type: 'address' },
      { name: 'minimumTriggerAmount', type: 'uint256' },
      { name: 'signalType', type: 'uint8' },
      { name: 'stableWeightBps', type: 'uint16' },
      { name: 'riskWeightBps', type: 'uint16' },
      { name: 'mode', type: 'uint8' },
      { name: 'automaticExecutionLimit', type: 'uint256' },
      { name: 'maximumActionAmount', type: 'uint256' },
      { name: 'maximumWeeklyAmount', type: 'uint256' },
      { name: 'maximumSlippageBps', type: 'uint16' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'cooldownSeconds', type: 'uint64' },
      { name: 'lastExecutionAt', type: 'uint64' },
      { name: 'weeklyWindowStartedAt', type: 'uint64' },
      { name: 'weeklySpent', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  }] },
] as const;

const cc3Client = createPublicClient({ chain: cc3, transport: http(cc3.rpcUrls.default.http[0]) });
const sepoliaClient = createPublicClient({
  chain: sepolia,
  transport: http('https://ethereum-sepolia-rpc.publicnode.com'),
});

export function walletFromUserId(userId: string): Address | undefined {
  return isAddress(userId) ? userId : undefined;
}

export async function readLiveAccount(userId: string) {
  const wallet = walletFromUserId(userId);
  if (!wallet) {
    return { userId, wallet: null, network: 'Creditcoin CC3 Testnet', note: 'Issue the MCP credential from the Affest Agents page while a wallet is connected.' };
  }
  const [tctc, eth, vault] = await Promise.all([
    cc3Client.getBalance({ address: wallet }),
    sepoliaClient.getBalance({ address: wallet }),
    cc3Client.readContract({ abi: vaultFactoryAbi, address: contracts.vaultFactory, functionName: 'vaultOf', args: [wallet] }),
  ]);
  let vaultTctc = 0n;
  let wrapped = 0n;
  if (vault !== '0x0000000000000000000000000000000000000000') {
    const stable = await cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'stableAsset' });
    const [walletWrap, vaultWrap] = await Promise.all([
      cc3Client.readContract({ abi: erc20Abi, address: stable, functionName: 'balanceOf', args: [wallet] }),
      cc3Client.readContract({ abi: erc20Abi, address: stable, functionName: 'balanceOf', args: [vault] }),
    ]);
    wrapped = walletWrap;
    vaultTctc = vaultWrap;
  }
  return {
    userId,
    wallet,
    network: 'Creditcoin CC3 Testnet',
    tctc: formatEther(tctc),
    wrappedTctc: formatEther(wrapped),
    vaultTctc: formatEther(vaultTctc),
    sepoliaEth: formatEther(eth),
    vault: vault === '0x0000000000000000000000000000000000000000' ? null : vault,
  };
}

export async function readLiveStrategies(userId: string) {
  const wallet = walletFromUserId(userId);
  if (!wallet) return [];
  const count = await cc3Client.readContract({
    abi: strategyManagerAbi,
    address: contracts.strategyManager,
    functionName: 'strategyCount',
  });
  const total = Number(count);
  const ids = Array.from({ length: Math.min(total, 32) }, (_, index) => BigInt(total - index));
  const rows = await Promise.all(ids.map(async (id) => {
    const strategy = await cc3Client.readContract({
      abi: strategyManagerAbi,
      address: contracts.strategyManager,
      functionName: 'getStrategy',
      args: [id],
    });
    return { id: id.toString(), strategy };
  }));
  return rows
    .filter((row) => row.strategy.owner.toLowerCase() === wallet.toLowerCase() && row.strategy.status !== 2)
    .map((row) => ({
      id: row.id,
      vault: row.strategy.vault,
      tctcWeightPct: row.strategy.stableWeightBps / 100,
      ethWeightPct: row.strategy.riskWeightBps / 100,
      mode: (['APPROVAL', 'AUTOMATIC', 'HYBRID'] as const)[row.strategy.mode] ?? 'HYBRID',
      status: row.strategy.status === 1 ? 'PAUSED' : 'ACTIVE',
      lastExecutionAt: row.strategy.lastExecutionAt.toString(),
    }));
}
