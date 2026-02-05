import React, { useState, useMemo } from 'react';
import { Plus, Loader2, Minus, Plus as PlusIcon, Hash } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import { useAccount, useBalance, useWriteContract } from 'wagmi';
import { TOKENS, TICK_SPACINGS } from '../../contracts/constants';
import { POOL_MANAGER_ABI, ERC20_ABI } from './abis';
import { POOL_MANAGER_ADDRESS } from '../../contracts/constants';
import { TokenKey, PoolKey } from './types';

interface AddLiquidityFormProps {
  poolKey: PoolKey;
  token0: TokenKey;
  token1: TokenKey;
  fee: number;
  isInitialized: boolean;
  onSuccess: () => void;
}

// Price to tick conversion
const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

const tickToPrice = (tick: number): number => {
  return Math.pow(1.0001, tick);
};

// Calculate liquidity delta from amounts (simplified)
const calculateLiquidityDelta = (
  amount0: bigint,
  amount1: bigint,
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number
): bigint => {
  // Simplified calculation - in production use full Uniswap v4 math
  const amount0Num = Number(formatUnits(amount0, 18));
  const amount1Num = Number(formatUnits(amount1, 18));
  const avgAmount = Math.sqrt(amount0Num * amount1Num);
  return BigInt(Math.floor(avgAmount * 1e6));
};

export function AddLiquidityForm({
  poolKey,
  token0,
  token1,
  fee,
  isInitialized,
  onSuccess,
}: AddLiquidityFormProps) {
  const { address } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [minPrice, setMinPrice] = useState('0.9');
  const [maxPrice, setMaxPrice] = useState('1.1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: bal0 } = useBalance({
    address,
    token: TOKENS[token0].isNative ? undefined : TOKENS[token0].address as `0x${string}`,
  });
  const { data: bal1 } = useBalance({
    address,
    token: TOKENS[token1].isNative ? undefined : TOKENS[token1].address as `0x${string}`,
  });

  const tickSpacing = TICK_SPACINGS[fee];

  // Calculate ticks from prices
  const { tickLower, tickUpper } = useMemo(() => {
    const lower = Math.floor(priceToTick(parseFloat(minPrice || '0.9')) / tickSpacing) * tickSpacing;
    const upper = Math.ceil(priceToTick(parseFloat(maxPrice || '1.1')) / tickSpacing) * tickSpacing;
    return { tickLower: lower, tickUpper: upper };
  }, [minPrice, maxPrice, tickSpacing]);

  // Adjust price inputs by percentage
  const adjustRange = (percent: number) => {
    const currentPrice = 1; // Assuming 1 for simplicity, should get from pool
    const range = percent / 100;
    setMinPrice((currentPrice * (1 - range)).toFixed(4));
    setMaxPrice((currentPrice * (1 + range)).toFixed(4));
  };

  const setFullRange = () => {
    setMinPrice(tickToPrice(-887220).toExponential(4));
    setMaxPrice(tickToPrice(887220).toExponential(4));
  };

  const handleMaxClick = (token: TokenKey) => {
    if (token === token0 && bal0) {
      setAmount0(formatUnits(bal0.value, bal0.decimals));
    } else if (token === token1 && bal1) {
      setAmount1(formatUnits(bal1.value, bal1.decimals));
    }
  };

  const handleAddLiquidity = async () => {
    if (!address || !amount0 || !amount1) return;
    setLoading(true);
    setError('');

    try {
      const amt0 = parseUnits(amount0, TOKENS[token0].decimals);
      const amt1 = parseUnits(amount1, TOKENS[token1].decimals);

      // Approve tokens first (if not native)
      if (!TOKENS[token0].isNative) {
        await writeContract({
          address: TOKENS[token0].address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POOL_MANAGER_ADDRESS, amt0],
        });
      }
      if (!TOKENS[token1].isNative) {
        await writeContract({
          address: TOKENS[token1].address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POOL_MANAGER_ADDRESS, amt1],
        });
      }

      // Add liquidity
      const liquidityDelta = calculateLiquidityDelta(amt0, amt1, 79228162514264337593543950336n, tickLower, tickUpper);

      await writeContract(
        {
          address: POOL_MANAGER_ADDRESS,
          abi: POOL_MANAGER_ABI,
          functionName: 'modifyLiquidity',
          args: [
            poolKey,
            {
              tickLower,
              tickUpper,
              liquidityDelta,
              salt: `0x${address?.slice(2).padStart(64, '0')}` as `0x${string}`,
            },
            '0x',
          ],
          value: TOKENS[token0].isNative ? amt0 : TOKENS[token1].isNative ? amt1 : 0n,
        },
        {
          onSuccess: () => {
            setAmount0('');
            setAmount1('');
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
        <Hash className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>Initialize the pool first to add liquidity</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-4 bg-blue-50 border-b border-blue-100">
        <h3 className="font-semibold text-blue-900 flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Liquidity
        </h3>
        <p className="text-sm text-blue-700">
          Provide liquidity and earn fees on trades
        </p>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Token 0 Input */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Input</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Balance: {bal0 ? parseFloat(formatUnits(bal0.value, bal0.decimals)).toFixed(4) : '0'}
              </span>
              <button
                onClick={() => handleMaxClick(token0)}
                className="text-xs text-blue-600 font-medium hover:text-blue-700"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amount0}
              onChange={(e) => setAmount0(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-medium focus:outline-none"
            />
            <span className="font-semibold text-gray-700">{TOKENS[token0].symbol}</span>
          </div>
        </div>

        {/* Token 1 Input */}
        <div className="bg-gray-50 rounded-xl p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Input</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">
                Balance: {bal1 ? parseFloat(formatUnits(bal1.value, bal1.decimals)).toFixed(4) : '0'}
              </span>
              <button
                onClick={() => handleMaxClick(token1)}
                className="text-xs text-blue-600 font-medium hover:text-blue-700"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amount1}
              onChange={(e) => setAmount1(e.target.value)}
              placeholder="0.0"
              className="flex-1 bg-transparent text-2xl font-medium focus:outline-none"
            />
            <span className="font-semibold text-gray-700">{TOKENS[token1].symbol}</span>
          </div>
        </div>

        {/* Price Range Section */}
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h4 className="font-medium text-gray-800">Set Price Range</h4>
            <div className="flex gap-2">
              <button
                onClick={() => adjustRange(10)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                ±10%
              </button>
              <button
                onClick={() => adjustRange(25)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                ±25%
              </button>
              <button
                onClick={() => adjustRange(50)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                ±50%
              </button>
              <button
                onClick={setFullRange}
                className="px-2 py-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
              >
                Full Range
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Min Price</label>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <button
                  onClick={() => setMinPrice((parseFloat(minPrice) * 0.99).toFixed(6))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="flex-1 bg-transparent text-center font-mono text-sm focus:outline-none"
                  step="0.0001"
                />
                <button
                  onClick={() => setMinPrice((parseFloat(minPrice) * 1.01).toFixed(6))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <PlusIcon className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">
                {TOKENS[token1].symbol} per {TOKENS[token0].symbol}
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Max Price</label>
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                <button
                  onClick={() => setMaxPrice((parseFloat(maxPrice) * 0.99).toFixed(6))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="number"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="flex-1 bg-transparent text-center font-mono text-sm focus:outline-none"
                  step="0.0001"
                />
                <button
                  onClick={() => setMaxPrice((parseFloat(maxPrice) * 1.01).toFixed(6))}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <PlusIcon className="w-3 h-3" />
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1 text-center">
                {TOKENS[token1].symbol} per {TOKENS[token0].symbol}
              </p>
            </div>
          </div>

          {/* Tick Info */}
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500 flex justify-between">
            <span>Tick Range: {tickLower} to {tickUpper}</span>
            <span>Spacing: {tickSpacing}</span>
          </div>
        </div>

        {/* Add Button */}
        <button
          onClick={handleAddLiquidity}
          disabled={isPending || loading || !amount0 || !amount1}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-xl font-semibold transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 inline animate-spin mr-2" />
              Adding Liquidity...
            </>
          ) : (
            'Add Liquidity'
          )}
        </button>
      </div>
    </div>
  );
}
