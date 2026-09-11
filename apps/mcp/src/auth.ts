import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';

export type CredentialRecord = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly hash: string;
  readonly expiresAt?: number;
  readonly revokedAt?: number;
};

export type AuthContext = {
  readonly credentialId: string;
  readonly userId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
};

export interface CredentialPersistence {
  load(): Promise<readonly CredentialRecord[]>;
  save(record: CredentialRecord): Promise<void>;
  revoke(id: string, revokedAt: number): Promise<boolean>;
  close(): Promise<void>;
}

export class PostgresCredentialPersistence implements CredentialPersistence {
  private readonly pool: Pool;
  private readonly initialized: Promise<void>;

  public constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    this.initialized = this.pool.query(`
      CREATE TABLE IF NOT EXISTS affest_mcp_credentials (
        id text PRIMARY KEY,
        user_id text NOT NULL,
        name text NOT NULL,
        credential_hash text NOT NULL UNIQUE,
        scopes text[] NOT NULL,
        expires_at timestamptz,
        revoked_at timestamptz
      )
    `).then(() => undefined);
  }

  public async load(): Promise<readonly CredentialRecord[]> {
    await this.initialized;
    const result = await this.pool.query<{
      id: string;
      user_id: string;
      name: string;
      credential_hash: string;
      scopes: string[];
      expires_at: Date | null;
      revoked_at: Date | null;
    }>('SELECT id, user_id, name, credential_hash, scopes, expires_at, revoked_at FROM affest_mcp_credentials');
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      name: row.name,
      hash: row.credential_hash,
      scopes: row.scopes,
      ...(row.expires_at ? { expiresAt: row.expires_at.getTime() } : {}),
      ...(row.revoked_at ? { revokedAt: row.revoked_at.getTime() } : {}),
    }));
  }

  public async save(record: CredentialRecord): Promise<void> {
    await this.initialized;
    await this.pool.query(
      `INSERT INTO affest_mcp_credentials (id, user_id, name, credential_hash, scopes, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET revoked_at = EXCLUDED.revoked_at`,
      [record.id, record.userId, record.name, record.hash, record.scopes, record.expiresAt ? new Date(record.expiresAt) : null, record.revokedAt ? new Date(record.revokedAt) : null],
    );
  }

  public async revoke(id: string, revokedAt: number): Promise<boolean> {
    await this.initialized;
    const result = await this.pool.query('UPDATE affest_mcp_credentials SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [id, new Date(revokedAt)]);
    return result.rowCount === 1;
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

export class CredentialStore {
  private readonly records = new Map<string, CredentialRecord>();
  private readonly restored: Promise<void>;

  public constructor(private readonly secret: string, private readonly persistence?: CredentialPersistence) {
    this.restored = this.restore();
  }

  public async ready(): Promise<void> {
    await this.restored;
  }

  public async issue(userId: string, name: string, scopes: readonly string[], ttlMs = 30 * 24 * 60 * 60 * 1000): Promise<{ token: string; record: CredentialRecord }> {
    await this.restored;
    const id = `cred_${randomToken(12)}`;
    const token = `aff_${randomToken(32)}`;
    const record: CredentialRecord = { id, userId, name, scopes, hash: this.hash(token), expiresAt: Date.now() + ttlMs };
    this.records.set(id, record);
    await this.persistence?.save(record);
    return { token, record };
  }

  public async revoke(id: string): Promise<boolean> {
    await this.restored;
    const record = this.records.get(id);
    if (!record || record.revokedAt) return false;
    const revokedAt = Date.now();
    this.records.set(id, { ...record, revokedAt });
    await this.persistence?.revoke(id, revokedAt);
    return true;
  }

  public async authenticate(header: string | undefined): Promise<AuthContext | undefined> {
    await this.restored;
    if (!header?.startsWith('Bearer ')) return undefined;
    const token = header.slice('Bearer '.length).trim();
    if (!token) return undefined;
    const digest = this.hash(token);
    for (const record of this.records.values()) {
      if (record.revokedAt || (record.expiresAt !== undefined && record.expiresAt <= Date.now())) continue;
      const left = Buffer.from(record.hash, 'hex');
      const right = Buffer.from(digest, 'hex');
      if (left.length !== right.length || !timingSafeEqual(left, right)) continue;
      return { credentialId: record.id, userId: record.userId, clientName: record.name, scopes: record.scopes };
    }
    return undefined;
  }

  private hash(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }

  private async restore(): Promise<void> {
    const records = await this.persistence?.load();
    for (const record of records ?? []) this.records.set(record.id, record);
  }
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
