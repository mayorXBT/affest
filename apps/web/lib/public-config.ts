import { getAddress, type Address } from 'viem';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://affest.cefo.dev';

// Leave this blank in production only when the MCP service is reverse-proxied
// through the dashboard origin. Local development uses the local MCP process.
export const mcpBaseUrl = trimTrailingSlash(
  process.env.NEXT_PUBLIC_MCP_BASE_URL?.trim()
    || (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8787' : ''),
);

export const creditcoinRpcUrl = process.env.NEXT_PUBLIC_CREDITCOIN_RPC_URL?.trim()
  || 'https://rpc.cc3-testnet.creditcoin.network';

export const creditcoinChainId = Number(process.env.NEXT_PUBLIC_CREDITCOIN_CHAIN_ID || 102031);

export const sepoliaRpcUrl = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL?.trim()
  || 'https://ethereum-sepolia-rpc.publicnode.com';

export function configuredAddress(value: string | undefined, fallback: Address): Address {
  return getAddress(value?.trim() || fallback);
}
