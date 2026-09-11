import { describe, expect, it } from 'vitest';
import { parseAttestcoinProof } from '../src/index.js';

const fixture = {
  chainKey: 1,
  headerNumber: 123,
  txIndex: 0,
  txHash: `0x${'11'.repeat(32)}`,
  txBytes: '0x1234',
  continuityProof: { lowerEndpointDigest: `0x${'22'.repeat(32)}`, roots: [`0x${'33'.repeat(32)}`] },
  merkleProof: { root: `0x${'44'.repeat(32)}`, siblings: [{ hash: `0x${'55'.repeat(32)}`, isLeft: true }] },
  cached: false,
  generatedAt: '2026-09-08T00:00:00.000Z',
};

describe('parseAttestcoinProof', () => {
  it('accepts the official SDK proof response shape', () => {
    const proof = parseAttestcoinProof(fixture);
    expect('ok' in proof).toBe(false);
    if (!('ok' in proof)) {
      expect(proof.chainKey).toBe(1);
      expect(proof.generatedAt).toBeInstanceOf(Date);
      expect(proof.merkleProof.siblings[0]?.isLeft).toBe(true);
    }
  });

  it('rejects a proof without continuity roots', () => {
    const result = parseAttestcoinProof({ ...fixture, continuityProof: { lowerEndpointDigest: fixture.continuityProof.lowerEndpointDigest, roots: [] } });
    expect(result).toEqual({ ok: false, error: 'continuityProof.roots: expected at least one attested root' });
  });
});
