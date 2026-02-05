// constants.ts
export const VERIFIER_ADDRESS = '0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981';
export const HOOK_ADDRESS = '0xCAC28E99c67B2f54A92f602046136899dA296080';
export const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543';
export const BATCH_DURATION = 10; // blocks

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