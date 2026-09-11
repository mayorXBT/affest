import { type Address, getAddress, isAddress, zeroAddress } from 'viem';
import { getBytecode, readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { creditcoinCc3, wagmiConfig } from '@/lib/chain';
import {
  cc3Contracts,
  sepoliaContracts,
  vaultAbi,
  vaultFactoryAbi,
} from '@/lib/contracts';

export const WRAPPER_KEY = 'affest.wtctc';

export function vaultStorageKey(owner: Address) {
  return `affest.vault.${owner.toLowerCase()}`;
}

export function readStoredAddress(key: string): Address | undefined {
  if (typeof window === 'undefined') return undefined;
  const value = window.localStorage.getItem(key);
  if (!value || !isAddress(value)) return undefined;
  return getAddress(value);
}

export function storeAddress(key: string, address: Address) {
  window.localStorage.setItem(key, getAddress(address));
}

export type VaultDeployers = {
  deployWrapper: () => Promise<`0x${string}`>;
  deployVault: (args: readonly [Address, Address, Address, Address]) => Promise<`0x${string}`>;
};

async function hasCode(address: Address) {
  const code = await getBytecode(wagmiConfig, { address, chainId: creditcoinCc3.id });
  return Boolean(code && code !== '0x');
}

export async function ensureWrappedTctc(deployers: VaultDeployers): Promise<Address> {
  const stored = readStoredAddress(WRAPPER_KEY);
  if (stored && await hasCode(stored)) return stored;
  const hash = await deployers.deployWrapper();
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (!receipt.contractAddress) throw new Error('WTCTC deploy returned no address');
  const wrapper = getAddress(receipt.contractAddress);
  storeAddress(WRAPPER_KEY, wrapper);
  return wrapper;
}

export async function ensureCc3Vault(input: {
  owner: Address;
  wrapper: Address;
  deployers: VaultDeployers;
  createVault: (wrapper: Address) => Promise<`0x${string}`>;
}): Promise<Address> {
  const stored = readStoredAddress(vaultStorageKey(input.owner));
  if (stored && await hasCode(stored)) return stored;

  const factoryVault = await readContract(wagmiConfig, {
    abi: vaultFactoryAbi,
    address: cc3Contracts.vaultFactory,
    functionName: 'vaultOf',
    args: [input.owner],
    chainId: creditcoinCc3.id,
  });

  if (factoryVault !== zeroAddress) {
    const stableAsset = await readContract(wagmiConfig, {
      abi: vaultAbi,
      address: factoryVault,
      functionName: 'stableAsset',
      chainId: creditcoinCc3.id,
    });
    if (stableAsset.toLowerCase() === input.wrapper.toLowerCase()) {
      storeAddress(vaultStorageKey(input.owner), factoryVault);
      return factoryVault;
    }
    return deploySidecarVault(input);
  }

  const hash = await input.createVault(input.wrapper);
  await waitForTransactionReceipt(wagmiConfig, { hash });
  const created = await readContract(wagmiConfig, {
    abi: vaultFactoryAbi,
    address: cc3Contracts.vaultFactory,
    functionName: 'vaultOf',
    args: [input.owner],
    chainId: creditcoinCc3.id,
  });
  if (created === zeroAddress) throw new Error('Vault factory did not index the new vault yet');
  storeAddress(vaultStorageKey(input.owner), created);
  return created;
}

async function deploySidecarVault(input: {
  owner: Address;
  wrapper: Address;
  deployers: VaultDeployers;
}): Promise<Address> {
  const hash = await input.deployers.deployVault([
    input.owner,
    input.wrapper,
    sepoliaContracts.weth,
    cc3Contracts.swapAdapter,
  ]);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (!receipt.contractAddress) throw new Error('Vault deploy returned no address');
  const vault = getAddress(receipt.contractAddress);
  storeAddress(vaultStorageKey(input.owner), vault);
  return vault;
}
