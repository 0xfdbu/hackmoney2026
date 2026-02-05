import { TOKENS } from '../../contracts/constants';

export type TokenKey = keyof typeof TOKENS;

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: bigint;
  hooks: `0x${string}`;
}

export type TabType = 'add' | 'remove' | 'darkpool';
