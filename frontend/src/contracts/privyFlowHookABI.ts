// ABI for the commit-reveal DarkPoolHook
export const PRIVYFLOW_HOOK_ABI = [
  {
    "inputs": [{"internalType": "contract IPoolManager", "name": "_manager", "type": "address"}],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "BATCH_DELAY",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "commitments",
    "outputs": [
      {"internalType": "uint256", "name": "submitBlock", "type": "uint256"},
      {"internalType": "bool", "name": "revealed", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "manager",
    "outputs": [{"internalType": "contract IPoolManager", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "bytes32", "name": "", "type": "bytes32"}],
    "name": "nullifierSpent",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "address", "name": "sender", "type": "address"},
      {"internalType": "tuple", "name": "key", "type": "tuple", "components": [
        {"internalType": "Currency", "name": "currency0", "type": "address"},
        {"internalType": "Currency", "name": "currency1", "type": "address"},
        {"internalType": "uint24", "name": "fee", "type": "uint24"},
        {"internalType": "int24", "name": "tickSpacing", "type": "int24"},
        {"internalType": "contract IHooks", "name": "hooks", "type": "address"}
      ]},
      {"internalType": "struct IPoolManager.SwapParams", "name": "params", "type": "tuple", "components": [
        {"internalType": "bool", "name": "zeroForOne", "type": "bool"},
        {"internalType": "int256", "name": "amountSpecified", "type": "int256"},
        {"internalType": "uint160", "name": "sqrtPriceLimitX96", "type": "uint160"}
      ]},
      {"internalType": "bytes", "name": "hookData", "type": "bytes"}
    ],
    "name": "beforeSwap",
    "outputs": [
      {"internalType": "bytes4", "name": "", "type": "bytes4"},
      {"internalType": "struct BeforeSwapDelta", "name": "", "type": "int256"},
      {"internalType": "uint24", "name": "", "type": "uint24"}
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "bytes32", "name": "commitment", "type": "bytes32"},
      {"indexed": true, "internalType": "bytes32", "name": "nullifier", "type": "bytes32"},
      {"indexed": false, "internalType": "uint256", "name": "revealBlock", "type": "uint256"}
    ],
    "name": "CommitSubmitted",
    "type": "event"
  }
] as const;
