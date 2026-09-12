import { Pool } from 'pg';

export type IndexedTrigger = {
  readonly id: string;
  readonly strategyId: string;
  readonly ownerWallet: string | null;
  readonly sourceChain: string;
  readonly transactionHash: string;
  readonly logIndex: number;
  readonly status: string;
  readonly statusPayload: Record<string, unknown>;
  readonly proof?: unknown;
};

type Row = {
  id: string;
  strategy_id: string;
  owner_wallet: string | null;
  source_chain: string;
  source_transaction_hash: string;
  log_index: number;
  status: string;
  status_payload: unknown;
  proof_json: unknown;
};

export class PostgresWorkerIndex {
  private readonly pool: Pool;

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 4 });
  }

  public async list(ownerWallet: string): Promise<readonly IndexedTrigger[]> {
    try {
      const result = await this.pool.query<Row>('SELECT id, strategy_id, owner_wallet, source_chain, source_transaction_hash, log_index, status, status_payload, proof_json FROM affest_worker_triggers WHERE lower(owner_wallet) = lower($1) ORDER BY detected_at DESC', [ownerWallet]);
      return result.rows.map((row) => this.toTrigger(row));
    } catch {
      return [];
    }
  }

  public async find(ownerWallet: string, transactionHash: string): Promise<IndexedTrigger | undefined> {
    const rows = await this.list(ownerWallet);
    return rows.find((row) => row.transactionHash.toLowerCase() === transactionHash.toLowerCase());
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }

  private toTrigger(row: Row): IndexedTrigger {
    const payload = row.status_payload && typeof row.status_payload === 'object' ? row.status_payload : {};
    return {
      id: row.id,
      strategyId: row.strategy_id,
      ownerWallet: row.owner_wallet,
      sourceChain: row.source_chain,
      transactionHash: row.source_transaction_hash,
      logIndex: row.log_index,
      status: row.status,
      statusPayload: payload as Record<string, unknown>,
      ...(row.proof_json !== null && row.proof_json !== undefined ? { proof: row.proof_json } : {}),
    };
  }
}
