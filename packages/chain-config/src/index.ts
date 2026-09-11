import { z } from 'zod';

export const CREDITCOIN_CC3 = {
  chainId: 102031,
  rpcUrl: 'https://rpc.cc3-testnet.creditcoin.network',
  explorerUrl: 'https://creditcoin-testnet.blockscout.com',
  nativeSymbol: 'TCTC',
} as const;

export const ETHEREUM_SEPOLIA = {
  chainId: 11155111,
  chainKey: 1,
  explorerUrl: 'https://sepolia.etherscan.io',
} as const;

const serverConfigSchema = z.object({
  SEPOLIA_RPC_URL: z.string().url().min(1),
  ATTESTCOIN_PROOF_API_URL: z.string().url().min(1),
});

export type ServerConfig = z.output<typeof serverConfigSchema>;

export function parseServerConfig(input: Record<string, unknown>): ServerConfig {
  if (Object.hasOwn(input, 'NEXT_PUBLIC_RELAYER_PRIVATE_KEY')) {
    throw new Error('relayer keys must never use a NEXT_PUBLIC_ variable');
  }
  const result = serverConfigSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  }
  return result.data;
}
