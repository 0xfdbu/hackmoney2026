export const POOL_MANAGER_ABI = [
  {
    inputs: [
      { components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ], name: 'key', type: 'tuple' },
      { name: 'sqrtPriceX96', type: 'uint160' }
    ],
    name: 'initialize',
    outputs: [{ name: 'tick', type: 'int24' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ], name: 'key', type: 'tuple' }
    ],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'slot', type: 'bytes32' }],
    name: 'extsload',
    outputs: [{ name: 'value', type: 'bytes32' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [
      { components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ], name: 'key', type: 'tuple' },
      { components: [
        { name: 'tickLower', type: 'int24' },
        { name: 'tickUpper', type: 'int24' },
        { name: 'liquidityDelta', type: 'int128' },
        { name: 'salt', type: 'bytes32' }
      ], name: 'params', type: 'tuple' },
      { name: 'hookData', type: 'bytes' }
    ],
    name: 'modifyLiquidity',
    outputs: [{ name: 'callerDelta', type: 'int256' }, { name: 'feesAccrued', type: 'int256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

export const HOOK_ABI = [
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'getBatchInfo',
    outputs: [
      { name: 'commitmentCount', type: 'uint256' },
      { name: 'settled', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'currentBatchId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'clearingPrice', type: 'uint256' }],
    name: 'settleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

export const ERC20_ABI = [
  {
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;
