export const PRIVY_FLOW_HOOK_ABI = [
  {
    "inputs": [
      {
        "internalType": "contract IPoolManager",
        "name": "_manager",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_verifier",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "manager",
    "outputs": [
      {
        "internalType": "contract IPoolManager",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "verifier",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getHookPermissions",
    "outputs": [
      {
        "components": [
          {
            "internalType": "bool",
            "name": "beforeInitialize",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterInitialize",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "beforeAddLiquidity",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterAddLiquidity",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "beforeRemoveLiquidity",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterRemoveLiquidity",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "beforeSwap",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterSwap",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "beforeDonate",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterDonate",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "beforeSwapReturnDelta",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterSwapReturnDelta",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterAddLiquidityReturnDelta",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "afterRemoveLiquidityReturnDelta",
            "type": "bool"
          }
        ],
        "internalType": "struct Hooks.Permissions",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "Currency",
            "name": "currency0",
            "type": "address"
          },
          {
            "internalType": "Currency",
            "name": "currency1",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "int24",
            "name": "tickSpacing",
            "type": "int24"
          },
          {
            "internalType": "contract IHooks",
            "name": "hooks",
            "type": "address"
          }
        ],
        "internalType": "struct PoolKey",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "bool",
            "name": "zeroForOne",
            "type": "bool"
          },
          {
            "internalType": "int256",
            "name": "amountSpecified",
            "type": "int256"
          },
          {
            "internalType": "uint160",
            "name": "sqrtPriceLimitX96",
            "type": "uint160"
          }
        ],
        "internalType": "struct SwapParams",
        "name": "",
        "type": "tuple"
      },
      {
        "internalType": "bytes",
        "name": "hookData",
        "type": "bytes"
      }
    ],
    "name": "beforeSwap",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      },
      {
        "internalType": "BeforeSwapDelta",
        "name": "",
        "type": "int256"
      },
      {
        "internalType": "uint24",
        "name": "",
        "type": "uint24"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      },
      {
        "components": [
          {
            "internalType": "Currency",
            "name": "currency0",
            "type": "address"
          },
          {
            "internalType": "Currency",
            "name": "currency1",
            "type": "address"
          },
          {
            "internalType": "uint24",
            "name": "fee",
            "type": "uint24"
          },
          {
            "internalType": "int24",
            "name": "tickSpacing",
            "type": "int24"
          },
          {
            "internalType": "contract IHooks",
            "name": "hooks",
            "type": "address"
          }
        ],
        "internalType": "struct PoolKey",
        "name": "",
        "type": "tuple"
      },
      {
        "components": [
          {
            "internalType": "bool",
            "name": "zeroForOne",
            "type": "bool"
          },
          {
            "internalType": "int256",
            "name": "amountSpecified",
            "type": "int256"
          },
          {
            "internalType": "uint160",
            "name": "sqrtPriceLimitX96",
            "type": "uint160"
          }
        ],
        "internalType": "struct SwapParams",
        "name": "",
        "type": "tuple"
      },
      {
        "internalType": "BalanceDelta",
        "name": "",
        "type": "int256"
      },
      {
        "internalType": "bytes",
        "name": "hookData",
        "type": "bytes"
      }
    ],
    "name": "afterSwap",
    "outputs": [
      {
        "internalType": "bytes4",
        "name": "",
        "type": "bytes4"
      },
      {
        "internalType": "int128",
        "name": "",
        "type": "int128"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;

export const PRIVY_FLOW_HOOK_ADDRESS = "0x80155F48AeADFB2cf5B27577c48A61e04F66BFde" as const;