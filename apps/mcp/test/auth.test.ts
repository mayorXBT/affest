import { describe, expect, it } from 'vitest';
import { CredentialStore, type CredentialPersistence, type CredentialRecord } from '../src/auth.js';

class MemoryPersistence implements CredentialPersistence {
  public readonly records = new Map<string, CredentialRecord>();

  public async load(): Promise<readonly CredentialRecord[]> {
    return [...this.records.values()];
  }

  public async save(record: CredentialRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  public async revoke(id: string, revokedAt: number): Promise<boolean> {
    const record = this.records.get(id);
    if (!record || record.revokedAt) return false;
    this.records.set(id, { ...record, revokedAt });
    return true;
  }

  public async close(): Promise<void> {}
}

describe('CredentialStore', () => {
  it('authenticates issued bearer tokens and never exposes the stored hash as a token', async () => {
    const store = new CredentialStore('test-secret');
    const issued = await store.issue('user-1', 'Claude', ['read']);
    expect(await store.authenticate(`Bearer ${issued.token}`)).toMatchObject({ userId: 'user-1', clientName: 'Claude' });
    expect(issued.record.hash).not.toBe(issued.token);
  });

  it('rejects revoked credentials', async () => {
    const store = new CredentialStore('test-secret');
    const issued = await store.issue('user-1', 'Agent', ['read']);
    expect(await store.revoke(issued.record.id)).toBe(true);
    expect(await store.authenticate(`Bearer ${issued.token}`)).toBeUndefined();
    expect(await store.revoke(issued.record.id)).toBe(false);
  });

  it('restores credentials after a process restart through persistence', async () => {
    const persistence = new MemoryPersistence();
    const firstProcess = new CredentialStore('test-secret', persistence);
    const issued = await firstProcess.issue('user-1', 'Agent', ['read']);
    const secondProcess = new CredentialStore('test-secret', persistence);
    expect(await secondProcess.authenticate(`Bearer ${issued.token}`)).toMatchObject({ userId: 'user-1', clientName: 'Agent' });
    expect(await secondProcess.revoke(issued.record.id)).toBe(true);
    const thirdProcess = new CredentialStore('test-secret', persistence);
    expect(await thirdProcess.authenticate(`Bearer ${issued.token}`)).toBeUndefined();
  });
});
