import React from 'react';
import { ArrowDownUp, Wallet } from 'lucide-react';
import { formatUnits } from 'viem';
import { useBalance, useAccount } from 'wagmi';
import { TOKENS, TICK_SPACINGS } from '../../contracts/constants';
import type { TokenKey } from './types';

interface PoolSelectorProps {
  token0: TokenKey;
  token1: TokenKey;
  fee: number;
  onToken0Change: (token: TokenKey) => void;
  onToken1Change: (token: TokenKey) => void;
  onFeeChange: (fee: number) => void;
  onSwapTokens: () => void;
}

export function PoolSelector({ token0, token1, fee, onToken0Change, onToken1Change, onFeeChange, onSwapTokens }: PoolSelectorProps) {
  const { address } = useAccount();
  const { data: bal0 } = useBalance({ address, token: TOKENS[token0].isNative ? undefined : TOKENS[token0].address as `0x${string}` });
  const { data: bal1 } = useBalance({ address, token: TOKENS[token1].isNative ? undefined : TOKENS[token1].address as `0x${string}` });

  const formatBal = (b: typeof bal0) => b ? parseFloat(formatUnits(b.value, b.decimals)).toFixed(4) : '0';

  return (
    <div className="space-y-3">
      {/* Token Pair */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <div className="flex items-center gap-2">
          <select value={token0} onChange={(e) => onToken0Change(e.target.value as TokenKey)} className="flex-1 p-2 border rounded">
            {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button onClick={onSwapTokens} className="p-2 bg-gray-100 rounded hover:bg-gray-200">
            <ArrowDownUp className="w-4 h-4" />
          </button>
          <select value={token1} onChange={(e) => onToken1Change(e.target.value as TokenKey)} className="flex-1 p-2 border rounded">
            {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-2">
          <span><Wallet className="w-3 h-3 inline" /> {formatBal(bal0)} {TOKENS[token0].symbol}</span>
          <span><Wallet className="w-3 h-3 inline" /> {formatBal(bal1)} {TOKENS[token1].symbol}</span>
        </div>
      </div>

      {/* Fee Tier */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <p className="text-sm font-medium mb-2">Fee Tier</p>
        <div className="flex gap-2">
          {[100, 500, 3000, 10000].map(f => (
            <button key={f} onClick={() => onFeeChange(f)} className={`flex-1 py-2 rounded border ${fee === f ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-gray-50'}`}>
              {f / 10000}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
