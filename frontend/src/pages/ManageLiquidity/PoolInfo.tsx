import React from 'react';
import { Check, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { HOOK_ADDRESS } from '../../contracts/constants';

interface PoolInfoProps {
  isInitialized: boolean;
  sqrtPriceX96?: bigint;
  tick?: number;
  loading?: boolean;
  onInitialize: () => void;
  onRefresh: () => void;
}

export function PoolInfo({
  isInitialized,
  sqrtPriceX96,
  tick,
  loading,
  onInitialize,
  onRefresh,
}: PoolInfoProps) {
  const calculatePrice = (sqrtPrice: bigint) => {
    const price = Number(sqrtPrice) / 2 ** 96;
    return (price * price).toFixed(6);
  };

  return (
    <div
      className={`rounded-xl border-2 p-4 ${
        isInitialized
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center ${
            isInitialized ? 'bg-green-100' : 'bg-yellow-100'
          }`}
        >
          {isInitialized ? (
            <Check className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-yellow-600" />
          )}
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">
            {isInitialized ? 'Pool is Active' : 'Pool Not Initialized'}
          </h3>
          <p className="text-sm text-gray-600">
            {isInitialized
              ? 'Liquidity can be added to this pool'
              : 'Initialize the pool before adding liquidity'}
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isInitialized && sqrtPriceX96 && (
        <div className="mt-4 pt-4 border-t border-green-200 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Price</p>
            <p className="font-mono font-semibold text-gray-800">
              {calculatePrice(sqrtPriceX96)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase">Current Tick</p>
            <p className="font-mono font-semibold text-gray-800">{tick}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 uppercase">Hook Address</p>
            <p className="font-mono text-sm text-gray-700 truncate">
              {HOOK_ADDRESS}
            </p>
          </div>
        </div>
      )}

      {!isInitialized && (
        <button
          onClick={onInitialize}
          disabled={loading}
          className="mt-4 w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
              Initializing...
            </>
          ) : (
            'Initialize Pool'
          )}
        </button>
      )}
    </div>
  );
}
