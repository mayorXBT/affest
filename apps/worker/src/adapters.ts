import { createPublicClient, http, isHex, parseAbiItem, type PublicClient } from 'viem';
import { sepolia } from 'viem/chains';
import { z } from 'zod';
import type { AttestationPort, SourceChainPort, SourceReceipt, SourceSignal } from './index.js';

const signalEvent = parseAbiItem('event PortfolioSignal(bytes32 indexed signalId, address indexed user, address indexed asset, uint256 amount, uint8 signalType)');
const attestedHeightSchema = z.object({ attestedHeight: z.number().int().nonnegative() });

export class SdkAttestationPort implements AttestationPort {
  private readonly builder: Promise<{ getProof(transactionHash: string): Promise<{ success: boolean; data?: unknown; error?: string }> }>;

  public constructor(
    private readonly chainKey: number,
    private readonly proofApiUrl: string,
    timeoutMs = 15_000,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.builder = import('@gluwa/usc-sdk').then(({ proofProvider }) => new proofProvider.service.ProofBuilder(chainKey, proofApiUrl, timeoutMs));
  }

  public async getAttestedHeight(chainKey: number): Promise<number> {
    if (chainKey !== this.chainKey) throw new Error(`unexpected chain key ${chainKey}`);
    const response = await this.fetchImpl(`${this.proofApiUrl}/api/v1/attested-height/${chainKey}`);
    if (!response.ok) throw new Error(`attested-height request failed: ${response.status}`);
    const body: unknown = await response.json();
    const parsed = attestedHeightSchema.safeParse(body);
    if (!parsed.success) throw new Error('attested-height response was malformed');
    return parsed.data.attestedHeight;
  }

  public async buildProof(chainKey: number, transactionHash: string): Promise<unknown> {
    if (chainKey !== this.chainKey) throw new Error(`unexpected chain key ${chainKey}`);
    const result = await (await this.builder).getProof(transactionHash);
    if (!result.success || result.data === undefined) throw new Error(result.error ?? 'proof builder returned no proof');
    return result.data;
  }

}

export class ViemSepoliaSourcePort implements SourceChainPort {
  private readonly client: PublicClient;

  public constructor(rpcUrl: string, private readonly signalContract: `0x${string}`) {
    this.client = createPublicClient({ chain: sepolia, transport: http(rpcUrl) });
  }

  public async latestBlock(): Promise<bigint> {
    return this.client.getBlockNumber();
  }

  public async listSignals(fromBlock: bigint): Promise<readonly SourceSignal[]> {
    const toBlock = await this.latestBlock();
    if (fromBlock > toBlock) return [];
    const logs = await this.client.getLogs({ address: this.signalContract, event: signalEvent, fromBlock, toBlock });
    return logs.map((log) => ({
      transactionHash: log.transactionHash,
      logIndex: Number(log.logIndex),
      ...(log.args.user ? { user: log.args.user } : {}),
      ...(log.args.asset ? { asset: log.args.asset } : {}),
      ...(log.args.amount !== undefined ? { amount: log.args.amount.toString() } : {}),
      ...(log.args.signalType !== undefined ? { signalType: log.args.signalType } : {}),
    }));
  }

  public async getReceipt(transactionHash: string): Promise<SourceReceipt> {
    if (!isHex(transactionHash)) throw new Error('source transaction hash is not hex');
    const receipt = await this.client.getTransactionReceipt({ hash: transactionHash });
    return { status: receipt.status === 'success' ? 'success' : 'reverted', blockNumber: Number(receipt.blockNumber) };
  }
}
