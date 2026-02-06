export const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
        internalType: 'struct PoolKey',
        name: 'key',
        type: 'tuple',
      },
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
    ],
    name: 'initialize',
    outputs: [{ name: 'tick', type: 'int24', internalType: 'int24' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
        internalType: 'struct PoolKey',
        name: 'key',
        type: 'tuple',
      },
      {
        components: [
          { name: 'zeroForOne', type: 'bool', internalType: 'bool' },
          { name: 'amountSpecified', type: 'int256', internalType: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160', internalType: 'uint160' },
        ],
        internalType: 'struct IPoolManager.SwapParams',
        name: 'params',
        type: 'tuple',
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    name: 'swap',
    outputs: [
      { name: 'swapDelta', type: 'int256', internalType: 'BalanceDelta' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
        internalType: 'struct PoolKey',
        name: 'key',
        type: 'tuple',
      },
    ],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160', internalType: 'uint160' },
      { name: 'tick', type: 'int24', internalType: 'int24' },
      { name: 'protocolFee', type: 'uint24', internalType: 'uint24' },
      { name: 'lpFee', type: 'uint24', internalType: 'uint24' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address', internalType: 'Currency' },
          { name: 'currency1', type: 'address', internalType: 'Currency' },
          { name: 'fee', type: 'uint24', internalType: 'uint24' },
          { name: 'tickSpacing', type: 'int24', internalType: 'int24' },
          { name: 'hooks', type: 'address', internalType: 'contract IHooks' },
        ],
        internalType: 'struct PoolKey',
        name: 'key',
        type: 'tuple',
      },
      {
        components: [
          { name: 'tickLower', type: 'int24', internalType: 'int24' },
          { name: 'tickUpper', type: 'int24', internalType: 'int24' },
          { name: 'liquidityDelta', type: 'int128', internalType: 'int128' },
          { name: 'salt', type: 'bytes32', internalType: 'bytes32' },
        ],
        internalType: 'struct IPoolManager.ModifyLiquidityParams',
        name: 'params',
        type: 'tuple',
      },
      { name: 'hookData', type: 'bytes', internalType: 'bytes' },
    ],
    name: 'modifyLiquidity',
    outputs: [
      { name: 'callerDelta', type: 'int256', internalType: 'BalanceDelta' },
      { name: 'feesAccrued', type: 'int256', internalType: 'BalanceDelta' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;
