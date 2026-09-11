import { defineChain, numberToHex } from 'viem';
import { sepolia } from 'viem/chains';
import { createConfig, fallback, http } from 'wagmi';
import { injected } from 'wagmi/connectors';

export { sepolia };

export const creditcoinCc3 = defineChain({
  id: 102031,
  name: 'Creditcoin CC3 Testnet',
  nativeCurrency: { name: 'Testnet CTC', symbol: 'TCTC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.cc3-testnet.creditcoin.network'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://creditcoin-testnet.blockscout.com' },
  },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [creditcoinCc3, sepolia],
  connectors: [injected({ shimDisconnect: true })],
  transports: {
    [creditcoinCc3.id]: http(creditcoinCc3.rpcUrls.default.http[0]),
    [sepolia.id]: fallback([
      http('https://ethereum-sepolia-rpc.publicnode.com'),
      http('https://1rpc.io/sepolia'),
    ]),
  },
  ssr: true,
});

export const cc3AddChainParams = {
  chainId: numberToHex(creditcoinCc3.id),
  chainName: creditcoinCc3.name,
  nativeCurrency: creditcoinCc3.nativeCurrency,
  rpcUrls: [...creditcoinCc3.rpcUrls.default.http],
  blockExplorerUrls: [creditcoinCc3.blockExplorers.default.url],
};

export const sepoliaAddChainParams = {
  chainId: numberToHex(sepolia.id),
  chainName: sepolia.name,
  nativeCurrency: sepolia.nativeCurrency,
  rpcUrls: ['https://ethereum-sepolia-rpc.publicnode.com', 'https://1rpc.io/sepolia'],
  blockExplorerUrls: [sepolia.blockExplorers.default.url],
};
