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
      { name: 'owner', type: 'address' }, { name: 'vault', type: 'address' }, { name: 'stableAsset', type: 'address' },
      { name: 'riskAsset', type: 'address' }, { name: 'triggerAsset', type: 'address' }, { name: 'minimumTriggerAmount', type: 'uint256' },
      { name: 'signalType', type: 'uint8' }, { name: 'stableWeightBps', type: 'uint16' }, { name: 'riskWeightBps', type: 'uint16' },
      { name: 'mode', type: 'uint8' }, { name: 'automaticExecutionLimit', type: 'uint256' }, { name: 'maximumActionAmount', type: 'uint256' },
      { name: 'maximumWeeklyAmount', type: 'uint256' }, { name: 'maximumSlippageBps', type: 'uint16' }, { name: 'expiresAt', type: 'uint64' },
      { name: 'cooldownSeconds', type: 'uint64' }, { name: 'lastExecutionAt', type: 'uint64' }, { name: 'weeklyWindowStartedAt', type: 'uint64' },
      { name: 'weeklySpent', type: 'uint256' }, { name: 'status', type: 'uint8' },
    ],
  }] },
] as const;

const cc3Client = createPublicClient({ chain: cc3, transport: http(cc3.rpcUrls.default.http[0]) });
const sepoliaClient = createPublicClient({ chain: sepolia, transport: http('https://ethereum-sepolia-rpc.publicnode.com') });

export function walletFromUserId(userId: string): Address | undefined {
  return isAddress(userId) ? userId : undefined;
}

export type LiveAssetBalance = {
  readonly asset: Address;
  readonly symbol: string | null;
  readonly decimals: number | null;
  readonly balance: string;
  readonly formatted: string;
  readonly readable: boolean;
  readonly contractExists: boolean;
  readonly reason?: string;
};

export type LiveVaultBalances = {
  readonly vault: Address;
  readonly owner: Address | null;
  readonly nativeTctc: string;
  readonly stable: LiveAssetBalance;
  readonly risk: LiveAssetBalance;
  readonly vaultExists?: boolean;
  readonly vaultStableAsset?: Address;
  readonly vaultRiskAsset?: Address;
};

export type ChainSnapshot = {
  readonly chainId: number;
  readonly latestBlock: string;
  readonly rpcUrl: string;
};

function emptyAsset(asset: Address, label: string, reason: string, contractExists = false): LiveAssetBalance {
  return { asset, symbol: null, decimals: null, balance: '0', formatted: '0', readable: false, contractExists, reason: `${label} asset ${asset} ${reason}` };
}

async function readAssetBalance(asset: Address, vault: Address, label: string): Promise<LiveAssetBalance> {
  try {
    const code = await cc3Client.getBytecode({ address: asset });
    if (!code || code === '0x') return emptyAsset(asset, label, 'has no contract code on Creditcoin CC3.');
    const [balance, decimals, symbol] = await Promise.all([
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'balanceOf', args: [vault] }),
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'decimals' }),
      cc3Client.readContract({ abi: erc20Abi, address: asset, functionName: 'symbol' }),
    ]);
    return { asset, symbol, decimals, balance: balance.toString(), formatted: formatUnits(balance, decimals), readable: true, contractExists: true };
  } catch (error: unknown) {
    return emptyAsset(asset, label, `could not be read on Creditcoin CC3: ${error instanceof Error ? error.message : 'ERC20 metadata or balanceOf failed'}`, true);
  }
}

export async function readChainSnapshot(): Promise<ChainSnapshot> {
  const [chainId, latestBlock] = await Promise.all([cc3Client.getChainId(), cc3Client.getBlockNumber()]);
  return { chainId, latestBlock: latestBlock.toString(), rpcUrl: cc3.rpcUrls.default.http[0] };
}

export async function readVaultBalances(vault: Address, expected?: { readonly stableAsset: Address; readonly riskAsset: Address }): Promise<LiveVaultBalances> {
  const stableAddress = expected?.stableAsset ?? zeroAddress;
  const riskAddress = expected?.riskAsset ?? zeroAddress;
  let code: `0x${string}` | undefined;
  try {
    code = await cc3Client.getBytecode({ address: vault });
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'vault bytecode read failed';
    return { vault, owner: null, nativeTctc: '0', vaultExists: false, stable: emptyAsset(stableAddress, 'Stable', `could not be read: ${reason}`), risk: emptyAsset(riskAddress, 'Risk', `could not be read: ${reason}`) };
  }
  if (!code || code === '0x') {
    return {
      vault, owner: null, nativeTctc: '0', vaultExists: false,
      stable: emptyAsset(stableAddress, 'Stable', 'cannot be read because the vault has no contract code on Creditcoin CC3.'),
      risk: emptyAsset(riskAddress, 'Risk', 'cannot be read because the vault has no contract code on Creditcoin CC3.'),
    };
  }
  let native: bigint;
  let owner: Address;
  let vaultStableAsset: Address;
  let vaultRiskAsset: Address;
  try {
    [native, owner, vaultStableAsset, vaultRiskAsset] = await Promise.all([
      cc3Client.getBalance({ address: vault }),
      cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'owner' }),
      cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'stableAsset' }),
      cc3Client.readContract({ abi: vaultAbi, address: vault, functionName: 'riskAsset' }),
    ]);
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'vault metadata read failed';
    return { vault, owner: null, nativeTctc: '0', vaultExists: true, stable: emptyAsset(stableAddress, 'Stable', `metadata could not be read: ${reason}`), risk: emptyAsset(riskAddress, 'Risk', `metadata could not be read: ${reason}`) };
  }
  const stable = await readAssetBalance(expected?.stableAsset ?? vaultStableAsset, vault, 'Stable');
  const risk = await readAssetBalance(expected?.riskAsset ?? vaultRiskAsset, vault, 'Risk');
  return { vault, owner, nativeTctc: native.toString(), stable, risk, vaultExists: true, vaultStableAsset, vaultRiskAsset };
}

export type RebalancePreflight = {
  readonly possible: boolean;
  readonly reason?: string;
  readonly nextAction?: string;
  readonly amountIn?: string;
  readonly direction?: 'stable-to-risk' | 'risk-to-stable';
};

export function rebalancePreflight(balances: LiveVaultBalances, stableWeightBps: number): RebalancePreflight {
  if (!balances.vaultExists && balances.vaultExists !== undefined) {
    return { possible: false, reason: 'Vault address has no contract code on Creditcoin CC3.', nextAction: 'Use the strategy vault address on Creditcoin CC3, or create a new portfolio vault.' };
  }
  if (!balances.stable.readable || !balances.risk.readable) {
    return { possible: false, reason: balances.stable.reason ?? balances.risk.reason ?? 'Vault assets could not be read on Creditcoin CC3.', nextAction: 'Use supported CC3 token addresses for both vault assets, then recreate any strategy that is misconfigured.' };
  }
  if (balances.stable.decimals !== balances.risk.decimals) {
    return { possible: false, reason: 'Vault assets use different decimals, so an allocation delta cannot be calculated safely.', nextAction: 'Use the supported CC3 asset pair with matching decimals.' };
  }
  const stable = BigInt(balances.stable.balance);
  const risk = BigInt(balances.risk.balance);
  const total = stable + risk;
  if (total === 0n) return { possible: false, reason: 'Vault has no assets. Deposit testnet TCTC/ETH before rebalancing.', nextAction: 'Deposit supported CC3 vault assets, then refresh the portfolio.' };
  const targetStable = total * BigInt(stableWeightBps) / 10_000n;
  const amountIn = stable > targetStable ? stable - targetStable : targetStable - stable;
  if (amountIn === 0n) return { possible: false, reason: 'Vault is already at the target allocation.', nextAction: 'Wait for the next verified trigger or change the strategy allocation.' };
  return { possible: true, amountIn: amountIn.toString(), direction: stable > targetStable ? 'stable-to-risk' : 'risk-to-stable' };
}

export type StrategyReadiness = 'READY' | 'BALANCED' | 'UNFUNDED' | 'MISCONFIGURED' | 'PAUSED' | 'REVOKED';

export type PortfolioStrategyDiagnostic = {
  readonly strategyId: string;
  readonly status: 'ACTIVE' | 'PAUSED' | 'REVOKED';
  readonly owner: Address;
  readonly vault: Address;
  readonly targetAllocation: { readonly stableWeightBps: number; readonly riskWeightBps: number };
  readonly stableAsset: LiveAssetBalance;
  readonly riskAsset: LiveAssetBalance;
  readonly triggerAsset: Address;
  readonly trigger: { readonly chain: 'ethereum-sepolia'; readonly asset: Address; readonly signalType: number; readonly minimumAmount: string };
  readonly nativeTctc: string;
  readonly vaultOwner: Address | null;
  readonly vaultExists: boolean;
  readonly vaultAssetsMatchStrategy: boolean;
  readonly vaultOwnerMatchesStrategy: boolean;
  readonly tokenContractsExist: { readonly stable: boolean; readonly risk: boolean };
  readonly configuration: { readonly valid: boolean; readonly reasons: readonly string[] };
  readonly readiness: { readonly status: StrategyReadiness; readonly possible: boolean; readonly reason?: string; readonly nextAction?: string };
  readonly rebalance: RebalancePreflight;
  readonly chain: ChainSnapshot;
  readonly onchain: { readonly mode: number; readonly lastExecutionAt: string; readonly cooldownSeconds: string; readonly expiresAt: string };
};

export type PortfolioDiagnostics = {
  readonly wallet: Address;
  readonly network: 'Creditcoin CC3 Testnet';
  readonly chain: ChainSnapshot;
  readonly strategies: readonly PortfolioStrategyDiagnostic[];
};

type OnchainStrategy = {
  readonly owner: Address;
  readonly vault: Address;
  readonly stableAsset: Address;
  readonly riskAsset: Address;
  readonly triggerAsset: Address;
  readonly minimumTriggerAmount: bigint;
  readonly signalType: number;
  readonly stableWeightBps: number;
  readonly riskWeightBps: number;
  readonly mode: number;
  readonly expiresAt: bigint;
  readonly cooldownSeconds: bigint;
  readonly lastExecutionAt: bigint;
  readonly status: number;
};

function statusLabel(status: number): PortfolioStrategyDiagnostic['status'] {
  if (status === 1) return 'PAUSED';
  if (status === 2) return 'REVOKED';
  return 'ACTIVE';
}

async function readStrategyDiagnostic(strategyId: bigint, strategy: OnchainStrategy, chain: ChainSnapshot): Promise<PortfolioStrategyDiagnostic> {
  const balances = await readVaultBalances(strategy.vault, { stableAsset: strategy.stableAsset, riskAsset: strategy.riskAsset });
  const vaultOwnerMatchesStrategy = Boolean(balances.owner && balances.owner.toLowerCase() === strategy.owner.toLowerCase());
  const vaultAssetsMatchStrategy = Boolean(balances.vaultStableAsset && balances.vaultRiskAsset && balances.vaultStableAsset.toLowerCase() === strategy.stableAsset.toLowerCase() && balances.vaultRiskAsset.toLowerCase() === strategy.riskAsset.toLowerCase());
  const reasons: string[] = [];
  if (!balances.vaultExists) reasons.push('Vault address has no contract code on Creditcoin CC3.');
  if (!balances.stable.contractExists) reasons.push(`Stable token ${strategy.stableAsset} has no contract code on Creditcoin CC3.`);
  if (!balances.risk.contractExists) reasons.push(`Risk token ${strategy.riskAsset} has no contract code on Creditcoin CC3.`);
  if (balances.vaultExists && !vaultOwnerMatchesStrategy) reasons.push(`Vault owner ${balances.owner ?? 'unknown'} does not match strategy owner ${strategy.owner}.`);
  if (balances.vaultExists && !vaultAssetsMatchStrategy) reasons.push('Vault token configuration does not match the strategy token configuration.');
  const configurationValid = reasons.length === 0;
  const rebalance = configurationValid ? rebalancePreflight(balances, strategy.stableWeightBps) : { possible: false, reason: reasons[0] ?? 'Strategy configuration is invalid.', nextAction: 'Recreate this strategy with the vault and supported CC3 token addresses shown in this diagnostic.' };
  const status = statusLabel(strategy.status);
  let readiness: StrategyReadiness = 'READY';
  if (status === 'PAUSED') readiness = 'PAUSED';
  else if (status === 'REVOKED') readiness = 'REVOKED';
  else if (!configurationValid) readiness = 'MISCONFIGURED';
  else if (rebalance.reason?.startsWith('Vault has no assets')) readiness = 'UNFUNDED';
  else if (rebalance.reason?.startsWith('Vault is already')) readiness = 'BALANCED';
  return {
    strategyId: strategyId.toString(), status, owner: strategy.owner, vault: strategy.vault,
    targetAllocation: { stableWeightBps: strategy.stableWeightBps, riskWeightBps: strategy.riskWeightBps },
    stableAsset: balances.stable, riskAsset: balances.risk, triggerAsset: strategy.triggerAsset,
    trigger: { chain: 'ethereum-sepolia', asset: strategy.triggerAsset, signalType: strategy.signalType, minimumAmount: strategy.minimumTriggerAmount.toString() },
    nativeTctc: formatEther(BigInt(balances.nativeTctc)), vaultOwner: balances.owner, vaultExists: balances.vaultExists ?? true,
    vaultAssetsMatchStrategy, vaultOwnerMatchesStrategy,
    tokenContractsExist: { stable: balances.stable.contractExists, risk: balances.risk.contractExists },
    configuration: { valid: configurationValid, reasons },
    readiness: { status: readiness, possible: status === 'ACTIVE' && rebalance.possible, ...(rebalance.reason ? { reason: rebalance.reason } : {}), ...(rebalance.nextAction ? { nextAction: rebalance.nextAction } : {}) },
    rebalance, chain,
    onchain: { mode: strategy.mode, lastExecutionAt: strategy.lastExecutionAt.toString(), cooldownSeconds: strategy.cooldownSeconds.toString(), expiresAt: strategy.expiresAt.toString() },
  };
}

export async function readPortfolioDiagnostics(userId: string): Promise<PortfolioDiagnostics | null> {
  const wallet = walletFromUserId(userId);
  if (!wallet) return null;
  const [chain, count] = await Promise.all([readChainSnapshot(), cc3Client.readContract({ abi: strategyManagerAbi, address: contracts.strategyManager, functionName: 'strategyCount' })]);
  const total = Number(count);
  const ids = Array.from({ length: total }, (_, index) => BigInt(index + 1));
  const rows = await Promise.all(ids.map(async (id) => ({ id, strategy: await cc3Client.readContract({ abi: strategyManagerAbi, address: contracts.strategyManager, functionName: 'getStrategy', args: [id] }) })));
  const owned = rows.filter((row) => row.strategy.owner.toLowerCase() === wallet.toLowerCase());
  const strategies = await Promise.all(owned.map((row) => readStrategyDiagnostic(row.id, row.strategy, chain)));
  return { wallet, network: 'Creditcoin CC3 Testnet', chain, strategies };
}

export async function readLiveAccount(userId: string) {
  const wallet = walletFromUserId(userId);
  if (!wallet) return { userId, wallet: null, network: 'Creditcoin CC3 Testnet', note: 'Issue the MCP credential from the Affest Agents page while a wallet is connected.' };
  const [tctc, eth, vault, chain] = await Promise.all([
    cc3Client.getBalance({ address: wallet }), sepoliaClient.getBalance({ address: wallet }),
    cc3Client.readContract({ abi: vaultFactoryAbi, address: contracts.vaultFactory, functionName: 'vaultOf', args: [wallet] }), readChainSnapshot(),
  ]);
  const vaultBalances = vault === zeroAddress ? undefined : await readVaultBalances(vault);
  const stable = vaultBalances?.stable.asset;
  const [walletWrap, vaultWrap] = stable && vaultBalances?.stable.readable
    ? await Promise.all([cc3Client.readContract({ abi: erc20Abi, address: stable, functionName: 'balanceOf', args: [wallet] }), Promise.resolve(BigInt(vaultBalances.stable.balance))])
    : [0n, 0n];
  return {
    userId, wallet, network: 'Creditcoin CC3 Testnet', chain,
    tctc: formatEther(tctc), wrappedTctc: formatEther(walletWrap), vaultTctc: formatEther(vaultWrap), sepoliaEth: formatEther(eth),
    vault: vault === zeroAddress ? null : vault,
    vaultBalances: vaultBalances ? { nativeTctc: formatEther(BigInt(vaultBalances.nativeTctc)), stable: vaultBalances.stable, risk: vaultBalances.risk } : null,
  };
}

export async function readLiveStrategies(userId: string) {
  const diagnostics = await readPortfolioDiagnostics(userId);
  if (!diagnostics) return [];
  return diagnostics.strategies.filter((item) => item.status !== 'REVOKED').map((item) => ({
    id: item.strategyId, vault: item.vault, owner: item.owner, stableAsset: item.stableAsset.asset, riskAsset: item.riskAsset.asset, triggerAsset: item.triggerAsset,
    tctcWeightPct: item.targetAllocation.stableWeightBps / 100, ethWeightPct: item.targetAllocation.riskWeightBps / 100,
    mode: (['APPROVAL', 'AUTOMATIC', 'HYBRID'] as const)[item.onchain.mode] ?? 'HYBRID', status: item.status, lastExecutionAt: item.onchain.lastExecutionAt,
    strategy: {
      vault: item.vault, stableAsset: item.stableAsset.asset, riskAsset: item.riskAsset.asset, triggerAsset: item.triggerAsset,
      stableWeightBps: item.targetAllocation.stableWeightBps, riskWeightBps: item.targetAllocation.riskWeightBps,
      mode: item.onchain.mode, status: item.status === 'PAUSED' ? 1 : 0, trigger: item.trigger,
      minimumTriggerAmount: BigInt(item.trigger.minimumAmount), lastExecutionAt: BigInt(item.onchain.lastExecutionAt), cooldownSeconds: BigInt(item.onchain.cooldownSeconds),
    },
    vaultBalances: { nativeTctc: item.nativeTctc, stable: item.stableAsset, risk: item.riskAsset }, rebalance: item.rebalance, diagnostic: item,
  }));
}
