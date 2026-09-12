import { createPublicClient, defineChain, formatEther, formatUnits, http, isAddress, zeroAddress, type Address } from 'viem';
import { sepolia } from 'viem/chains';

const cc3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Testnet CTC', symbol: 'TCTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
});

const contracts = {
  strategyManager: (process.env.AFFEST_STRATEGY_MANAGER_ADDRESS ?? '0xf016A45345857aeE7e93C987B4429840B779020B') as Address,
  vaultFactory: (process.env.AFFEST_VAULT_FACTORY_ADDRESS ?? '0x6A83bC86a1cF17b7F5a22d96e6aF376402491749') as Address,
};

const vaultFactoryAbi = [
  { type: 'function', name: 'vaultOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
] as const;

const vaultAbi = [
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'riskAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const;

const erc20Abi = [
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
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

export type LiveAssetBalance = {
  readonly asset: Address;
  readonly symbol: string | null;
  readonly decimals: number | null;
  readonly balance: string;
  readonly readable: boolean;
  readonly reason?: string;
};

export type LiveVaultBalances = {
  readonly vault: Address;
  readonly owner: Address | null;
  readonly nativeTctc: string;
  readonly stable: LiveAssetBalance;
  readonly risk: LiveAssetBalance;
};

async function readAssetBalance(asset: Address, vault: Address, label: string): Promise<LiveAssetBalance> {
  const empty = { asset, symbol: null, decimals: null, balance: '0', readable: false } as const;
  try {
    const code = await cc3Client.getBytecode({ address: asset });
    if (!code || code === '0x') return { ...empty, reason: `${label} asset ${asset} has no contract code on Creditcoin CC3.` };
    const [balance, decimals, symbol] = await Promise.all([
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'balanceOf', args: [vault] }),
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'decimals' }),
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'symbol' }),
    ]);
    return { asset, symbol, decimals, balance: balance.toString(), readable: true };
  } catch (error: unknown) {
    return { ...empty, reason: `${label} asset ${asset} could not be read on Creditcoin CC3: ${error instanceof Error ? error.message : 'balanceOf failed'}` };
  }
}

export async function readVaultBalances(vault: Address): Promise<LiveVaultBalances> {
  const [native, owner, stableAsset, riskAsset] = await Promise.all([
    cc3Client.getBalance({ address: vault }),
    cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'owner' }),
    cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'stableAsset' }),
    cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'riskAsset' }),
  ]);
  const [stable, risk] = await Promise.all([
    readAssetBalance(stableAsset, vault, 'Stable'),
    readAssetBalance(riskAsset, vault, 'Risk'),
  ]);
  return { vault, owner, nativeTctc: native.toString(), stable, risk };
}

export type RebalancePreflight = {
  readonly possible: boolean;
  readonly reason?: string;
  readonly nextAction?: string;
  readonly amountIn?: string;
  readonly direction?: 'stable-to-risk' | 'risk-to-stable';
};

export function rebalancePreflight(balances: LiveVaultBalances, stableWeightBps: number): RebalancePreflight {
  if (!balances.stable.readable || !balances.risk.readable) {
    return {
      possible: false,
      reason: balances.stable.reason ?? balances.risk.reason ?? 'Vault assets could not be read on Creditcoin CC3.',
      nextAction: 'Use the CC3 token addresses configured by the vault, then recreate any strategy that references a source-chain token address.',
    };
  }
  const stable = BigInt(balances.stable.balance);
  const risk = BigInt(balances.risk.balance);
  const total = stable + risk;
  if (total === 0n) return { possible: false, reason: 'Vault has no assets. Deposit testnet TCTC/ETH before rebalancing.', nextAction: 'Deposit supported CC3 vault assets, then refresh the portfolio.' };
  const targetStable = total * BigInt(stableWeightBps) / 10_000n;
  const amountIn = stable > targetStable ? stable - targetStable : targetStable - stable;
  if (amountIn === 0n) return { possible: false, reason: 'Vault is already at the target allocation.', nextAction: 'Wait for the next trigger or change the strategy allocation.' };
  return { possible: true, amountIn: amountIn.toString(), direction: stable > targetStable ? 'stable-to-risk' : 'risk-to-stable' };
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
  let vaultBalances: LiveVaultBalances | undefined;
  if (vault !== zeroAddress) {
    vaultBalances = await readVaultBalances(vault);
    const stable = vaultBalances.stable.asset;
    const [walletWrap, vaultWrap] = await Promise.all([
      vaultBalances.stable.readable ? cc3Client.readContract({ abi: erc20Abi, address: stable, functionName: 'balanceOf', args: [wallet] }) : Promise.resolve(0n),
      Promise.resolve(BigInt(vaultBalances.stable.balance)),
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
    vault: vault === zeroAddress ? null : vault,
    vaultBalances: vaultBalances ? {
      nativeTctc: formatEther(BigInt(vaultBalances.nativeTctc)),
      stable: { ...vaultBalances.stable, formatted: vaultBalances.stable.decimals === null ? '0' : formatUnits(BigInt(vaultBalances.stable.balance), vaultBalances.stable.decimals) },
      risk: { ...vaultBalances.risk, formatted: vaultBalances.risk.decimals === null ? '0' : formatUnits(BigInt(vaultBalances.risk.balance), vaultBalances.risk.decimals) },
    } : null,
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
    const balances = await readVaultBalances(strategy.vault);
    return { id: id.toString(), strategy, balances, preflight: rebalancePreflight(balances, strategy.stableWeightBps) };
  }));
  return rows
    .filter((row) => row.strategy.owner.toLowerCase() === wallet.toLowerCase() && row.strategy.status !== 2)
    .map((row) => ({
      id: row.id,
      vault: row.strategy.vault,
      owner: row.strategy.owner,
      stableAsset: row.strategy.stableAsset,
      riskAsset: row.strategy.riskAsset,
      triggerAsset: row.strategy.triggerAsset,
      tctcWeightPct: row.strategy.stableWeightBps / 100,
      ethWeightPct: row.strategy.riskWeightBps / 100,
      mode: (['APPROVAL', 'AUTOMATIC', 'HYBRID'] as const)[row.strategy.mode] ?? 'HYBRID',
      status: row.strategy.status === 1 ? 'PAUSED' : 'ACTIVE',
      lastExecutionAt: row.strategy.lastExecutionAt.toString(),
      vaultBalances: {
        nativeTctc: formatEther(BigInt(row.balances.nativeTctc)),
        stable: row.balances.stable,
        risk: row.balances.risk,
      },
      rebalance: row.preflight,
    }));
}
