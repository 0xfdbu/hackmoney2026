export const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543' as const;
export const HOOK_ADDRESS = '0xfb669Bf6BEC2423E4a1aeD0363d09B632CDd54F9' as const;

export const TOKENS = {
  ETH: { 
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