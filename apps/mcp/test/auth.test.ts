import { describe, expect, it } from 'vitest';
import { CredentialStore } from '../src/auth.js';

describe('CredentialStore', () => {
  it('authenticates issued bearer tokens and never exposes the stored hash as a token', () => {
    const store = new CredentialStore('test-secret');
    const issued = store.issue('user-1', 'Claude', ['read']);
    expect(store.authenticate(`Bearer ${issued.token}`)).toMatchObject({ userId: 'user-1', clientName: 'Claude' });
    expect(issued.record.hash).not.toBe(issued.token);
  });

  it('rejects revoked credentials', () => {
    const store = new CredentialStore('test-secret');
    const issued = store.issue('user-1', 'Agent', ['read']);
    expect(store.revoke(issued.record.id)).toBe(true);
    expect(store.authenticate(`Bearer ${issued.token}`)).toBeUndefined();
    expect(store.revoke(issued.record.id)).toBe(false);
  });
});
