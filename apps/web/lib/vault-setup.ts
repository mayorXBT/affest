import { type Address, getAddress, isAddress, zeroAddress } from 'viem';
import { getBytecode, readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { creditcoinCc3, wagmiConfig } from '@/lib/chain';
import {
  cc3Contracts,
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

async function isMatchingVault(address: Address, wrapper: Address, riskAsset: Address) {
  if (!(await hasCode(address))) return false;
  const [stable, risk] = await Promise.all([
    readContract(wagmiConfig, {
      abi: vaultAbi,
      address,
      functionName: 'stableAsset',
      chainId: creditcoinCc3.id,
    }),
    readContract(wagmiConfig, {
      abi: vaultAbi,
      address,
      functionName: 'riskAsset',
      chainId: creditcoinCc3.id,
    }),
  ]);
  return stable.toLowerCase() === wrapper.toLowerCase() && risk.toLowerCase() === riskAsset.toLowerCase();
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
  /** Asset held on Creditcoin for the risk sleeve (never a source-chain address). */
  riskAsset: Address;
  deployers: VaultDeployers;
  createVault: (wrapper: Address) => Promise<`0x${string}`>;
}): Promise<Address> {
  const stored = readStoredAddress(vaultStorageKey(input.owner));
  if (stored && await isMatchingVault(stored, input.wrapper, input.riskAsset)) return stored;

  const factoryVault = await readContract(wagmiConfig, {
    abi: vaultFactoryAbi,
    address: cc3Contracts.vaultFactory,
    functionName: 'vaultOf',
    args: [input.owner],
    chainId: creditcoinCc3.id,
  });

  if (factoryVault !== zeroAddress) {
    if (await isMatchingVault(factoryVault, input.wrapper, input.riskAsset)) {
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
  riskAsset: Address;
  deployers: VaultDeployers;
}): Promise<Address> {
  const hash = await input.deployers.deployVault([
    input.owner,
    input.wrapper,
    input.riskAsset,
    cc3Contracts.swapAdapter,
  ]);
  const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
  if (!receipt.contractAddress) throw new Error('Vault deploy returned no address');
  const vault = getAddress(receipt.contractAddress);
  storeAddress(vaultStorageKey(input.owner), vault);
  return vault;
}
