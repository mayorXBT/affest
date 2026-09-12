import { createPublicClient, createWalletClient, defineChain, http, isAddress, type Address, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { AttestcoinProof } from '@affest/api-contracts';
import type { TriggerRecord } from '@affest/database';
import type { CreditcoinPort } from './index.js';

const cc3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Testnet CTC', symbol: 'TCTC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] } },
});

const strategyManagerAbi = [{
  type: 'function', name: 'getStrategy', stateMutability: 'view', inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [{
    type: 'tuple', components: [
      { name: 'owner', type: 'address' }, { name: 'vault', type: 'address' }, { name: 'stableAsset', type: 'address' },
      { name: 'riskAsset', type: 'address' }, { name: 'triggerAsset', type: 'address' }, { name: 'minimumTriggerAmount', type: 'uint256' },
      { name: 'signalType', type: 'uint8' }, { name: 'stableWeightBps', type: 'uint16' }, { name: 'riskWeightBps', type: 'uint16' },
      { name: 'mode', type: 'uint8' }, { name: 'automaticExecutionLimit', type: 'uint256' }, { name: 'maximumActionAmount', type: 'uint256' },
      { name: 'maximumWeeklyAmount', type: 'uint256' }, { name: 'maximumSlippageBps', type: 'uint16' }, { name: 'expiresAt', type: 'uint64' },
      { name: 'cooldownSeconds', type: 'uint64' }, { name: 'lastExecutionAt', type: 'uint64' }, { name: 'weeklyWindowStartedAt', type: 'uint64' },
      { name: 'weeklySpent', type: 'uint256' }, { name: 'status', type: 'uint8' },
    ],
  }] as const,
}, { type: 'function', name: 'executor', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

const verifierAbi = [{ type: 'function', name: 'authorizedCaller', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;

const vaultAbi = [{ type: 'function', name: 'swapAdapter', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] }] as const;
const erc20Abi = [{ type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] }] as const;
const executorAbi = [{
  type: 'function', name: 'requestRebalance', stateMutability: 'nonpayable',
  inputs: [
    { name: 'strategyId', type: 'uint256' },
    { name: 'proof', type: 'tuple', components: [
      { name: 'chainKey', type: 'uint64' }, { name: 'blockHeight', type: 'uint64' }, { name: 'encodedTransaction', type: 'bytes' },
      { name: 'merkleRoot', type: 'bytes32' }, { name: 'siblings', type: 'tuple[]', components: [{ name: 'hash', type: 'bytes32' }, { name: 'isLeft', type: 'bool' }] },
      { name: 'lowerEndpointDigest', type: 'bytes32' }, { name: 'continuityRoots', type: 'bytes32[]' },
    ] },
    { name: 'receiptLogIndex', type: 'uint256' },
    { name: 'action', type: 'tuple', components: [
      { name: 'adapter', type: 'address' }, { name: 'assetIn', type: 'address' }, { name: 'assetOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' }, { name: 'minimumAmountOut', type: 'uint256' }, { name: 'slippageBps', type: 'uint16' },
    ] },
  ],
  outputs: [{ name: 'eventKey', type: 'bytes32' }, { name: 'automatic', type: 'bool' }],
}] as const;

export type CreditcoinAdapterConfig = {
  readonly rpcUrl: string;
  readonly privateKey: `0x${string}`;
  readonly strategyManager: Address;
  readonly executor: Address;
  readonly attestationVerifier: Address;
};

export class ViemCreditcoinPort implements CreditcoinPort {
  private readonly publicClient;
  private readonly walletClient;
  private readonly account;

  public constructor(private readonly config: CreditcoinAdapterConfig) {
    this.account = privateKeyToAccount(config.privateKey);
    this.publicClient = createPublicClient({ chain: cc3, transport: http(config.rpcUrl) });
    this.walletClient = createWalletClient({ account: this.account, chain: cc3, transport: http(config.rpcUrl) });
  }

  public async simulateProof(input: { readonly trigger: TriggerRecord; readonly proof: AttestcoinProof }): Promise<{ readonly ok: true } | { readonly ok: false; readonly reason: string }> {
    try {
      const args = await this.requestArgs(input.trigger, input.proof);
      await this.publicClient.simulateContract({ account: this.account, address: this.config.executor, abi: executorAbi, functionName: 'requestRebalance', args });
      return { ok: true };
    } catch (error: unknown) {
      return { ok: false, reason: error instanceof Error ? error.message : 'Creditcoin simulation failed' };
    }
  }

  public async assertRoleWiring(): Promise<void> {
    const [configuredExecutor, authorizedCaller] = await Promise.all([
      this.publicClient.readContract({ abi: strategyManagerAbi, address: this.config.strategyManager, functionName: 'executor' }),
      this.publicClient.readContract({ abi: verifierAbi, address: this.config.attestationVerifier, functionName: 'authorizedCaller' }),
    ]);
    if (configuredExecutor.toLowerCase() !== this.config.executor.toLowerCase()) {
      throw new Error(`AffestStrategyManager.executor() is ${configuredExecutor}; expected ${this.config.executor}. Run setExecutor from the contract administrator.`);
    }
    if (authorizedCaller.toLowerCase() !== this.config.executor.toLowerCase()) {
      throw new Error(`AffestAttestationVerifier.authorizedCaller() is ${authorizedCaller}; expected ${this.config.executor}. Run setAuthorizedCaller from the contract administrator.`);
    }
  }

  public async submitProof(input: { readonly trigger: TriggerRecord; readonly proof: AttestcoinProof }): Promise<{ readonly transactionHash: string; readonly eventKey: string; readonly automatic: boolean; readonly approvalExpiresAt?: Date }> {
    const args = await this.requestArgs(input.trigger, input.proof);
    const simulation = await this.publicClient.simulateContract({ account: this.account, address: this.config.executor, abi: executorAbi, functionName: 'requestRebalance', args });
    const [eventKey, automatic] = simulation.result;
    const hash = await this.walletClient.writeContract({ account: this.account, address: this.config.executor, abi: executorAbi, functionName: 'requestRebalance', args });
    await this.publicClient.waitForTransactionReceipt({ hash });
    return {
      transactionHash: hash,
      eventKey,
      automatic,
      ...(automatic ? {} : { approvalExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }),
    };
  }

  private async requestArgs(trigger: TriggerRecord, proof: AttestcoinProof) {
    const strategyId = BigInt(trigger.strategyId);
    const strategy = await this.publicClient.readContract({ abi: strategyManagerAbi, address: this.config.strategyManager, functionName: 'getStrategy', args: [strategyId] });
    const [stableBalance, riskBalance, adapter] = await Promise.all([
      this.publicClient.readContract({ abi: erc20Abi, address: strategy.stableAsset, functionName: 'balanceOf', args: [strategy.vault] }),
      this.publicClient.readContract({ abi: erc20Abi, address: strategy.riskAsset, functionName: 'balanceOf', args: [strategy.vault] }),
      this.publicClient.readContract({ abi: vaultAbi, address: strategy.vault, functionName: 'swapAdapter' }),
    ]);
    const total = stableBalance + riskBalance;
    if (total === 0n) throw new Error('vault has no assets to rebalance');
    const targetStable = total * BigInt(strategy.stableWeightBps) / 10_000n;
    const stableToRisk = stableBalance > targetStable;
    const rawAmount = stableToRisk ? stableBalance - targetStable : targetStable - stableBalance;
    const amountIn = rawAmount > strategy.maximumActionAmount ? strategy.maximumActionAmount : rawAmount;
    if (amountIn === 0n) throw new Error('vault is already at target allocation');
    const slippageBps = Math.min(strategy.maximumSlippageBps, 1_000);
    const minimumAmountOut = amountIn * BigInt(10_000 - slippageBps) / 10_000n;
    const action = {
      adapter,
      assetIn: stableToRisk ? strategy.stableAsset : strategy.riskAsset,
      assetOut: stableToRisk ? strategy.riskAsset : strategy.stableAsset,
      amountIn,
      minimumAmountOut,
      slippageBps,
    } as const;
    const contractProof = {
      chainKey: BigInt(proof.chainKey),
      blockHeight: BigInt(proof.headerNumber),
      encodedTransaction: toHex(proof.txBytes),
      merkleRoot: toHex(proof.merkleProof.root),
      siblings: proof.merkleProof.siblings.map((sibling) => ({ hash: toHex(sibling.hash), isLeft: sibling.isLeft })),
      lowerEndpointDigest: toHex(proof.continuityProof.lowerEndpointDigest),
      continuityRoots: proof.continuityProof.roots.map(toHex),
    } as const;
    return [strategyId, contractProof, BigInt(trigger.logIndex), action] as const;
  }
}

function toHex(value: string): Hex {
  if (!/^0x[0-9a-fA-F]*$/.test(value)) throw new Error('Attestcoin proof contains a non-hex value');
  return value as Hex;
}

export function parsePrivateKey(value: string): `0x${string}` {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('RELAYER_PRIVATE_KEY must be a 32-byte hex private key');
  return value as `0x${string}`;
}

export function parseAddress(value: string, name: string): Address {
  if (!isAddress(value)) throw new Error(`${name} must be a valid contract address`);
  return value;
}
