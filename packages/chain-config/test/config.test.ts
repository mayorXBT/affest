import { describe, expect, it } from 'vitest';
import { parseServerConfig, CREDITCOIN_CC3, ETHEREUM_SEPOLIA } from '../src/index.js';

describe('chain configuration', () => {
  it('exposes verified CC3 and Sepolia identifiers', () => {
    expect(CREDITCOIN_CC3.chainId).toBe(102031);
    expect(ETHEREUM_SEPOLIA.chainId).toBe(11155111);
    expect(ETHEREUM_SEPOLIA.chainKey).toBe(1);
  });

  it('rejects a server configuration with a missing RPC endpoint', () => {
    expect(() => parseServerConfig({ SEPOLIA_RPC_URL: '', ATTESTCOIN_PROOF_API_URL: 'https://prover.example' })).toThrow();
  });

  it('rejects a public relayer key variable', () => {
    expect(() => parseServerConfig({ SEPOLIA_RPC_URL: 'https://sepolia.example', ATTESTCOIN_PROOF_API_URL: 'https://prover.example', NEXT_PUBLIC_RELAYER_PRIVATE_KEY: 'secret' })).toThrow();
  });
});
