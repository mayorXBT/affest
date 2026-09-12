import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';

export type CredentialRecord = {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly scopes: readonly string[];
  readonly hash: string;
  readonly revokedAt?: number;
};

export type AuthContext = {
  readonly credentialId: string;
  readonly userId: string;
  readonly clientName: string;
  readonly scopes: readonly string[];
};

export type ChatgptLinkRecord = {
  readonly ticketHash: string;
  readonly credentialId: string;
  readonly createdAt: number;
  readonly revokedAt?: number;
};

export interface CredentialPersistence {
  load(): Promise<readonly CredentialRecord[]>;
  save(record: CredentialRecord): Promise<void>;
  revoke(id: string, revokedAt: number): Promise<boolean>;
  loadChatgptLinks?(): Promise<readonly ChatgptLinkRecord[]>;
  saveChatgptLink?(record: ChatgptLinkRecord): Promise<void>;
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
      );
      CREATE TABLE IF NOT EXISTS affest_mcp_chatgpt_links (
        ticket_hash text PRIMARY KEY,
        credential_id text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
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
      ...(row.revoked_at ? { revokedAt: row.revoked_at.getTime() } : {}),
    }));
  }

  public async save(record: CredentialRecord): Promise<void> {
    await this.initialized;
    await this.pool.query(
      `INSERT INTO affest_mcp_credentials (id, user_id, name, credential_hash, scopes, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (id) DO UPDATE SET revoked_at = EXCLUDED.revoked_at`,
      [record.id, record.userId, record.name, record.hash, record.scopes, null, record.revokedAt ? new Date(record.revokedAt) : null],
    );
  }

  public async revoke(id: string, revokedAt: number): Promise<boolean> {
    await this.initialized;
    const result = await this.pool.query('UPDATE affest_mcp_credentials SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL', [id, new Date(revokedAt)]);
    return result.rowCount === 1;
  }

  public async loadChatgptLinks(): Promise<readonly ChatgptLinkRecord[]> {
    await this.initialized;
    const result = await this.pool.query<{ ticket_hash: string; credential_id: string; created_at: Date; revoked_at: Date | null }>('SELECT ticket_hash, credential_id, created_at, revoked_at FROM affest_mcp_chatgpt_links');
    return result.rows.map((row) => ({
      ticketHash: row.ticket_hash,
      credentialId: row.credential_id,
      createdAt: row.created_at.getTime(),
      ...(row.revoked_at ? { revokedAt: row.revoked_at.getTime() } : {}),
    }));
  }

  public async saveChatgptLink(record: ChatgptLinkRecord): Promise<void> {
    await this.initialized;
    await this.pool.query(
      `INSERT INTO affest_mcp_chatgpt_links (ticket_hash, credential_id, created_at, revoked_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ticket_hash) DO UPDATE SET revoked_at = EXCLUDED.revoked_at`,
      [record.ticketHash, record.credentialId, new Date(record.createdAt), record.revokedAt ? new Date(record.revokedAt) : null],
    );
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

  /**
   * Issue a revocable credential with no time-based expiry.
   *
   * Long-lived credentials are intentional for MCP clients that cannot attach
   * a bearer header on every request (for example, a ChatGPT connector URL).
   * Revocation remains the only invalidation mechanism, and the database keeps
   * the legacy nullable expires_at column for backwards-compatible migrations.
   */
  public async issue(userId: string, name: string, scopes: readonly string[]): Promise<{ token: string; record: CredentialRecord }> {
    await this.restored;
    const id = `cred_${randomToken(12)}`;
    const token = `aff_${randomToken(32)}`;
    const record: CredentialRecord = { id, userId, name, scopes, hash: this.hash(token) };
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
      const auth = this.authForRecord(record);
      if (!auth) continue;
      const left = Buffer.from(record.hash, 'hex');
      const right = Buffer.from(digest, 'hex');
      if (left.length !== right.length || !timingSafeEqual(left, right)) continue;
      return auth;
    }
    return undefined;
  }

  public async authForCredential(id: string): Promise<AuthContext | undefined> {
    await this.restored;
    const record = this.records.get(id);
    return record ? this.authForRecord(record) : undefined;
  }

  private authForRecord(record: CredentialRecord): AuthContext | undefined {
    if (record.revokedAt) return undefined;
    return { credentialId: record.id, userId: record.userId, clientName: record.name, scopes: record.scopes };
  }

  private hash(token: string): string {
    return createHmac('sha256', this.secret).update(token).digest('hex');
  }

  private async restore(): Promise<void> {
    const records = await this.persistence?.load();
    for (const record of records ?? []) this.records.set(record.id, record);
  }
}

export class ChatgptLinkStore {
  private readonly records = new Map<string, ChatgptLinkRecord>();
  private readonly restored: Promise<void>;

  public constructor(private readonly secret: string, private readonly persistence?: CredentialPersistence) {
    this.restored = this.restore();
  }

  public async ready(): Promise<void> {
    await this.restored;
  }

  public async issue(auth: AuthContext): Promise<string> {
    await this.restored;
    const ticket = `agt_${randomToken(32)}`;
    const record: ChatgptLinkRecord = { ticketHash: this.hash(ticket), credentialId: auth.credentialId, createdAt: Date.now() };
    this.records.set(record.ticketHash, record);
    await this.persistence?.saveChatgptLink?.(record);
    return ticket;
  }

  public async authenticate(ticket: string, credentials: CredentialStore): Promise<AuthContext | undefined> {
    await this.restored;
    const record = this.records.get(this.hash(ticket));
    if (!record || record.revokedAt) return undefined;
    const auth = await credentials.authForCredential(record.credentialId);
    return auth ? { ...auth, scopes: ['read'] } : undefined;
  }

  private hash(ticket: string): string {
    return createHmac('sha256', this.secret).update(ticket).digest('hex');
  }

  private async restore(): Promise<void> {
    const records = await this.persistence?.loadChatgptLinks?.();
    for (const record of records ?? []) this.records.set(record.ticketHash, record);
  }
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
