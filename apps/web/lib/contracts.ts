export const cc3Contracts = {
  swapAdapter: '0xd010E8bdbd492124aF10D2ac3f025beaC2E9D44C',
  strategyManager: '0xf016A45345857aeE7e93C987B4429840B779020B',
  vaultFactory: '0x6A83bC86a1cF17b7F5a22d96e6aF376402491749',
} as const;

export const cc3StartBlock = 5_451_926n;

export const legacyDemoTokens = {
  stable: '0x5b185DC5443dca8bda7C4ca7De1a6BcA8d73C2b6',
  risk: '0x3cC438F47c330AB747cf5404c573156221beD2fD',
} as const;

export const sepoliaContracts = {
  weth: '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9',
} as const;

export const erc20Abi = [
  { type: 'function', name: 'name', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'symbol', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { type: 'function', name: 'decimals', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'allowance', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

export const wrappedNativeAbi = [
  ...erc20Abi,
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'depositAndApprove', stateMutability: 'payable', inputs: [{ name: 'spender', type: 'address' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] },
  { type: 'event', name: 'Deposit', inputs: [
    { name: 'dst', type: 'address', indexed: true },
    { name: 'wad', type: 'uint256', indexed: false },
  ] },
  { type: 'event', name: 'Withdrawal', inputs: [
    { name: 'src', type: 'address', indexed: true },
    { name: 'wad', type: 'uint256', indexed: false },
  ] },
] as const;

export const wethAbi = [
  ...erc20Abi,
  { type: 'function', name: 'deposit', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'wad', type: 'uint256' }], outputs: [] },
] as const;

export const vaultFactoryAbi = [
  { type: 'function', name: 'vaultOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'createVault', stateMutability: 'nonpayable', inputs: [
    { name: 'stableAsset', type: 'address' },
    { name: 'riskAsset', type: 'address' },
    { name: 'swapAdapter', type: 'address' },
  ], outputs: [{ name: 'vaultAddress', type: 'address' }] },
  { type: 'event', name: 'VaultCreated', inputs: [
    { name: 'owner', type: 'address', indexed: true },
    { name: 'vault', type: 'address', indexed: true },
  ] },
] as const;

export const vaultAbi = [
  {
    type: 'constructor',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'owner_', type: 'address' },
      { name: 'stableAsset_', type: 'address' },
      { name: 'riskAsset_', type: 'address' },
      { name: 'swapAdapter_', type: 'address' },
    ],
  },
  { type: 'function', name: 'deposit', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'withdraw', stateMutability: 'nonpayable', inputs: [{ name: 'asset', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'owner', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'stableAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'riskAsset', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'event', name: 'Deposit', inputs: [
    { name: 'sender', type: 'address', indexed: true },
    { name: 'asset', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ] },
  { type: 'event', name: 'Withdrawal', inputs: [
    { name: 'asset', type: 'address', indexed: true },
    { name: 'amount', type: 'uint256', indexed: false },
  ] },
] as const;

export const strategyManagerAbi = [
  { type: 'function', name: 'strategyCount', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'createStrategy', stateMutability: 'nonpayable', inputs: [{
    name: 'policy',
    type: 'tuple',
    components: [
      { name: 'vault', type: 'address' },
      { name: 'stableAsset', type: 'address' },
      { name: 'riskAsset', type: 'address' },
      { name: 'triggerAsset', type: 'address' },
      { name: 'minimumTriggerAmount', type: 'uint256' },
      { name: 'signalType', type: 'uint8' },
      { name: 'stableWeightBps', type: 'uint16' },
      { name: 'riskWeightBps', type: 'uint16' },
      { name: 'mode', type: 'uint8' },
      { name: 'automaticExecutionLimit', type: 'uint256' },
      { name: 'maximumActionAmount', type: 'uint256' },
      { name: 'maximumWeeklyAmount', type: 'uint256' },
      { name: 'maximumSlippageBps', type: 'uint16' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'cooldownSeconds', type: 'uint64' },
    ],
  }], outputs: [{ name: 'strategyId', type: 'uint256' }] },
  { type: 'function', name: 'getStrategy', stateMutability: 'view', inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [{
    type: 'tuple',
    components: [
      { name: 'owner', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'stableAsset', type: 'address' },
      { name: 'riskAsset', type: 'address' },
      { name: 'triggerAsset', type: 'address' },
      { name: 'minimumTriggerAmount', type: 'uint256' },
      { name: 'signalType', type: 'uint8' },
      { name: 'stableWeightBps', type: 'uint16' },
      { name: 'riskWeightBps', type: 'uint16' },
      { name: 'mode', type: 'uint8' },
      { name: 'automaticExecutionLimit', type: 'uint256' },
      { name: 'maximumActionAmount', type: 'uint256' },
      { name: 'maximumWeeklyAmount', type: 'uint256' },
      { name: 'maximumSlippageBps', type: 'uint16' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'cooldownSeconds', type: 'uint64' },
      { name: 'lastExecutionAt', type: 'uint64' },
      { name: 'weeklyWindowStartedAt', type: 'uint64' },
      { name: 'weeklySpent', type: 'uint256' },
      { name: 'status', type: 'uint8' },
    ],
  }] },
  { type: 'function', name: 'pauseStrategy', stateMutability: 'nonpayable', inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [] },
  { type: 'function', name: 'resumeStrategy', stateMutability: 'nonpayable', inputs: [{ name: 'strategyId', type: 'uint256' }], outputs: [] },
  { type: 'event', name: 'StrategyCreated', inputs: [
    { name: 'strategyId', type: 'uint256', indexed: true },
    { name: 'owner', type: 'address', indexed: true },
    { name: 'vault', type: 'address', indexed: true },
    { name: 'mode', type: 'uint8', indexed: false },
  ] },
] as const;
