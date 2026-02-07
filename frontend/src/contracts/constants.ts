// constants.ts
// Sepolia testnet addresses
export const HOOK_ADDRESS = '0x77853497C9dEC9460fb305cbcD80C7DAF4EcDC54';
export const COMMIT_STORE_ADDRESS = '0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C';
export const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543';
export const POSITION_MANAGER_ADDRESS = '0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4';
export const PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
export const BATCH_DURATION = 10;
export const ROUTER_ADDRESS = '0xB276FA545ed8848EC49b2a925c970313253B90Ba';

// Pool configuration - matches UI-created pool (ETH/USDC, 0.05%)
export const POOL_FEE = 500;
export const POOL_TICK_SPACING = 10;

// Token configuration
export const TOKENS = {
  ETH: { 
    address: '0x0000000000000000000000000000000000000000', // Native ETH
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

// Sqrt price limits for swaps
// For zeroForOne=true (ETH->USDC): use MIN_SQRT_PRICE + 1
// For zeroForOne=false (USDC->ETH): use MAX_SQRT_PRICE - 1
export const MIN_SQRT_PRICE = 4295128740n; // MIN_SQRT_RATIO + 1
export const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970341n; // MAX_SQRT_RATIO - 1