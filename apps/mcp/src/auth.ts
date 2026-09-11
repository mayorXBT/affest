import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

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

export class CredentialStore {
  private readonly records = new Map<string, CredentialRecord>();

  public constructor(private readonly secret: string) {}

  public issue(userId: string, name: string, scopes: readonly string[], ttlMs = 30 * 24 * 60 * 60 * 1000): { token: string; record: CredentialRecord } {
    const id = `cred_${randomToken(12)}`;
    const token = `aff_${randomToken(32)}`;
    const record: CredentialRecord = { id, userId, name, scopes, hash: this.hash(token), expiresAt: Date.now() + ttlMs };
    this.records.set(id, record);
    return { token, record };
  }

  public revoke(id: string): boolean {
    const record = this.records.get(id);
    if (!record || record.revokedAt) return false;
    this.records.set(id, { ...record, revokedAt: Date.now() });
    return true;
  }

  public authenticate(header: string | undefined): AuthContext | undefined {
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
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString('hex');
}
