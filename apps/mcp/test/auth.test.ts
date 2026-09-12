import { describe, expect, it } from 'vitest';
import { ChatgptLinkStore, CredentialStore, type ChatgptLinkRecord, type CredentialPersistence, type CredentialRecord } from '../src/auth.js';

class MemoryPersistence implements CredentialPersistence {
  public readonly records = new Map<string, CredentialRecord>();
  public readonly links = new Map<string, ChatgptLinkRecord>();

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

  public async loadChatgptLinks(): Promise<readonly ChatgptLinkRecord[]> {
    return [...this.links.values()];
  }

  public async saveChatgptLink(record: ChatgptLinkRecord): Promise<void> {
    this.links.set(record.ticketHash, record);
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

  it('keeps issued credentials valid until explicitly revoked', async () => {
    const store = new CredentialStore('test-secret');
    const issued = await store.issue('user-1', 'Long-lived MCP client', ['read']);
    expect(issued.record).not.toHaveProperty('expiresAt');
    expect(await store.authenticate(`Bearer ${issued.token}`)).toMatchObject({ userId: 'user-1' });
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

  it('restores a persistent read-only ChatGPT link and disables it when the parent credential is revoked', async () => {
    const persistence = new MemoryPersistence();
    const credentials = new CredentialStore('test-secret', persistence);
    const issued = await credentials.issue('user-1', 'Agent', ['read', 'action']);
    const firstProcess = new ChatgptLinkStore('test-secret', persistence);
    const ticket = await firstProcess.issue({ credentialId: issued.record.id, userId: 'user-1', clientName: 'Agent', scopes: ['read', 'action'] });
    const secondProcess = new ChatgptLinkStore('test-secret', persistence);
    expect(await secondProcess.authenticate(ticket, credentials)).toMatchObject({ userId: 'user-1', scopes: ['read'] });
    await credentials.revoke(issued.record.id);
    expect(await secondProcess.authenticate(ticket, credentials)).toBeUndefined();
  });
});
