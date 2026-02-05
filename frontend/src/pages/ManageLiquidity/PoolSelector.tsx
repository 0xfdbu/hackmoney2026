import React from 'react';
import { ArrowDownUp, Wallet } from 'lucide-react';
import { formatUnits } from 'viem';
import { useBalance } from 'wagmi';
import { useAccount } from 'wagmi';
import { TOKENS, TICK_SPACINGS } from '../../contracts/constants';
import { TokenKey } from './types';

interface PoolSelectorProps {
  token0: TokenKey;
  token1: TokenKey;
  fee: number;
  onToken0Change: (token: TokenKey) => void;
  onToken1Change: (token: TokenKey) => void;
  onFeeChange: (fee: number) => void;
  onSwapTokens: () => void;
}

export function PoolSelector({
  token0,
  token1,
  fee,
  onToken0Change,
  onToken1Change,
  onFeeChange,
  onSwapTokens,
}: PoolSelectorProps) {
  const { address } = useAccount();

  const { data: bal0 } = useBalance({
    address,
    token: TOKENS[token0].isNative ? undefined : TOKENS[token0].address as `0x${string}`,
  });
  const { data: bal1 } = useBalance({
    address,
    token: TOKENS[token1].isNative ? undefined : TOKENS[token1].address as `0x${string}`,
  });

  const formatBalance = (balance: typeof bal0) => {
    if (!balance) return '0';
    return parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4);
  };

  const feeTiers = [
    { value: 100, label: '0.01%', desc: 'Best for very stable pairs' },
    { value: 500, label: '0.05%', desc: 'Best for stable pairs' },
    { value: 3000, label: '0.3%', desc: 'Best for most pairs' },
    { value: 10000, label: '1%', desc: 'Best for exotic pairs' },
  ];

  return (
    <div className="space-y-4">
      {/* Token Selection Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Select Pair</h3>
        </div>
        
        <div className="p-4 space-y-3">
          {/* Token 0 */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase">Token 1</label>
              <select
                value={token0}
                onChange={(e) => onToken0Change(e.target.value as TokenKey)}
                className="w-full bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer"
              >
                {Object.keys(TOKENS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Wallet className="w-3 h-3" />
                <span>{formatBalance(bal0)}</span>
              </div>
              <span className="text-xs text-gray-400">{TOKENS[token0].symbol}</span>
            </div>
          </div>

          {/* Swap Button */}
          <div className="flex justify-center -my-1 relative z-10">
            <button
              onClick={onSwapTokens}
              className="bg-white border border-gray-200 rounded-full p-2 shadow-sm hover:shadow-md transition-shadow"
            >
              <ArrowDownUp className="w-4 h-4 text-gray-600" />
            </button>
          </div>

          {/* Token 1 */}
          <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg">
            <div className="flex-1">
              <label className="text-xs font-medium text-gray-500 uppercase">Token 2</label>
              <select
                value={token1}
                onChange={(e) => onToken1Change(e.target.value as TokenKey)}
                className="w-full bg-transparent font-semibold text-gray-800 focus:outline-none cursor-pointer"
              >
                {Object.keys(TOKENS).map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Wallet className="w-3 h-3" />
                <span>{formatBalance(bal1)}</span>
              </div>
              <span className="text-xs text-gray-400">{TOKENS[token1].symbol}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Fee Tier Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold text-gray-800">Fee Tier</h3>
          <p className="text-xs text-gray-500">The amount earned by LPs on trades in the pool</p>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-2 gap-3">
            {feeTiers.map((tier) => (
              <button
                key={tier.value}
                onClick={() => onFeeChange(tier.value)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  fee === tier.value
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className={`font-semibold ${fee === tier.value ? 'text-blue-700' : 'text-gray-800'}`}>
                  {tier.label}
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{tier.desc}</div>
                <div className="text-xs text-gray-400 mt-1">
                  Tick spacing: {TICK_SPACINGS[tier.value]}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
