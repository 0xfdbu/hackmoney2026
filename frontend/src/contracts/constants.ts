// constants.ts
// Sepolia testnet addresses
export const HOOK_ADDRESS = '0x1846217Bae61BF26612BD8d9a64b970d525B4080'; // DarkPoolHook
export const COMMIT_STORE_ADDRESS = '0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C';
export const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543';
export const POSITION_MANAGER_ADDRESS = '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4'; // v4 PositionManager
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
// old export const ROUTER_ADDRESS = '0x36b42E07273CD8ECfF1125bF15771AE356F085B1'; 
export const BATCH_DURATION = 10; // blocks
export const ROUTER_ADDRESS = '0x035c8980b8FdAcd324bEf3c17a67CCd6Eb32BaCC'; // NEW
// Pool fee tier - using 0.05% (500) for the new pool
// Old pool used 0.3% (3000) which had price issues
export const POOL_FEE = 500;
export const POOL_TICK_SPACING = 10;

// IMPORTANT: Uniswap v4 uses WETH address for pool keys, not the zero address.
// ETH.isNative=true means we treat it as native for UI purposes (balances, wrapping).
// But for pool operations, we use the WETH address.

export const TOKENS = {
  ETH: { 
    // Uniswap v4 uses address(0) for native ETH in pool keys
    address: '0x0000000000000000000000000000000000000000', 
    decimals: 18, 
    symbol: 'ETH',
    isNative: true 
  },
  USDC: { 
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', 
    decimals: 6, 
    symbol: 'USDC',
    isNative: false 
  },
  WETH: { 
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', 
    decimals: 18, 
    symbol: 'WETH',
    isNative: false 
  },
};

export const TICK_SPACINGS: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

// Uniswap v4 sqrt price limits
// For zeroForOne=true (token0 -> token1): use MIN_SQRT_PRICE + 1
// For zeroForOne=false (token1 -> token0): use MAX_SQRT_PRICE - 1
export const MIN_SQRT_PRICE = 4295128739n;
export const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n;