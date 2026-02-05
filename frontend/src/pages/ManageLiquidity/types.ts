import { TOKENS } from '../../contracts/constants';

export type TokenKey = keyof typeof TOKENS;

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: bigint;
  hooks: `0x${string}`;
}

export interface Slot0 {
  sqrtPriceX96: bigint;
  tick: number;
  protocolFee: number;
  lpFee: number;
}

export interface BatchInfo {
  commitmentCount: bigint;
  settled: boolean;
  clearingPrice: bigint;
}

export interface LiquidityParams {
  tickLower: number;
  tickUpper: number;
  liquidityDelta: bigint;
  salt: `0x${string}`;
}

export type TabType = 'add' | 'remove' | 'darkpool';
