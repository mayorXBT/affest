import { sepolia } from 'viem/chains';
import { creditcoinCc3 } from '@/lib/chain';
import { sepoliaContracts } from '@/lib/contracts';

export const tctcAsset = {
  id: 'TCTC',
  kind: 'cc3-native',
  symbol: 'TCTC',
  name: 'Testnet CTC',
  chainId: creditcoinCc3.id,
  chainLabel: 'Creditcoin CC3',
} as const;

export const ethAsset = {
  id: 'ETH',
  kind: 'sepolia-native',
  symbol: 'ETH',
  name: 'Ether',
  chainId: sepolia.id,
  chainLabel: 'Ethereum Sepolia',
  wrapped: sepoliaContracts.weth,
} as const;

export const affestAssets = [tctcAsset, ethAsset] as const;

export type AffestAsset = (typeof affestAssets)[number];
export type AffestAssetId = AffestAsset['id'];

export function assetById(id: AffestAssetId): AffestAsset {
  if (id === 'ETH') return ethAsset;
  return tctcAsset;
}
