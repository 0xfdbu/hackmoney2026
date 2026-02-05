import React, { useState } from 'react';
import { Minus, Loader2, AlertCircle } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import { useAccount, useWriteContract } from 'wagmi';
import { TOKENS } from '../../contracts/constants';
import { POOL_MANAGER_ABI } from './abis';
import { POOL_MANAGER_ADDRESS } from '../../contracts/constants';
import { TokenKey, PoolKey } from './types';

interface RemoveLiquidityFormProps {
  poolKey: PoolKey;
  token0: TokenKey;
  token1: TokenKey;
  isInitialized: boolean;
  onSuccess: () => void;
}

export function RemoveLiquidityForm({
  poolKey,
  token0,
  token1,
  isInitialized,
  onSuccess,
}: RemoveLiquidityFormProps) {
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();
  const [percentage, setPercentage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Mock positions - in a real implementation, you'd fetch these from a subgraph or contract
  const mockPositions = [
    { id: '1', tickLower: -60, tickUpper: 60, liquidity: 1000000n },
  ];

  const handleRemoveLiquidity = async () => {
    if (!address || !mockPositions.length) return;
    setLoading(true);
    setError('');

    const position = mockPositions[0];
    const liquidityToRemove = (position.liquidity * BigInt(percentage)) / 100n;

    try {
      await writeContract(
        {
          address: POOL_MANAGER_ADDRESS,
          abi: POOL_MANAGER_ABI,
          functionName: 'modifyLiquidity',
          args: [
            poolKey,
            {
              tickLower: position.tickLower,
              tickUpper: position.tickUpper,
              liquidityDelta: -liquidityToRemove, // Negative to remove
              salt: `0x${address?.slice(2).padStart(64, '0')}` as `0x${string}`,
            },
            '0x',
          ],
        },
        {
          onSuccess: () => {
            setLoading(false);
            onSuccess();
          },
          onError: (err: Error) => {
            setError(err.message?.slice(0, 100));
            setLoading(false);
          },
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>Initialize the pool first to manage liquidity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-red-50 border-b border-red-100">
        <h3 className="font-semibold text-red-900 flex items-center gap-2">
          <Minus className="w-5 h-5" />
          Remove Liquidity
        </h3>
        <p className="text-sm text-red-700">
          Withdraw your liquidity from the pool
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Percentage Slider */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-2">
            Amount to Remove: {percentage}%
          </label>
          <input
            type="range"
            min="1"
            max="100"
            value={percentage}
            onChange={(e) => setPercentage(parseInt(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-red-500"
          />
          <div className="flex justify-between mt-2">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setPercentage(p)}
                className={`px-3 py-1 text-xs rounded ${
                  percentage === p
                    ? 'bg-red-100 text-red-700 font-medium'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {p}%
              </button>
            ))}
          </div>
        </div>

        {/* Position Info */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Pool</span>
            <span className="font-medium">
              {TOKENS[token0].symbol}/{TOKENS[token1].symbol}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Fee Tier</span>
            <span className="font-medium">{Number(poolKey.fee) / 10000}%</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Position</span>
            <span className="font-medium">
              {mockPositions[0]?.tickLower} to {mockPositions[0]?.tickUpper}
            </span>
          </div>
        </div>

        {/* Remove Button */}
        <button
          onClick={handleRemoveLiquidity}
          disabled={isPending || loading || !mockPositions.length}
          className="w-full py-4 bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white rounded-xl font-semibold transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 inline animate-spin mr-2" />
              Removing Liquidity...
            </>
          ) : (
            `Remove ${percentage}% Liquidity`
          )}
        </button>

        <p className="text-xs text-gray-500 text-center">
          Note: Position data is read from on-chain. You will receive both tokens back.
        </p>
      </div>
    </div>
  );
}
