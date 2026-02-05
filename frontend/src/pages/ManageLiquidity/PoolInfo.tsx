import React, { useState } from 'react';
import { Check, AlertCircle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';

interface PoolKey {
  currency0: string;
  currency1: string;
  fee: number;
  tickSpacing: bigint;
  hooks: string;
}

interface PoolInfoProps {
  isInitialized: boolean;
  currentPrice: number;
  loading?: boolean;
  slot0Raw?: readonly [bigint, number, number, number];
  poolKey?: PoolKey;
  poolError?: string;
  onInitialize: () => void;
  onRefresh: () => void;
}

export function PoolInfo({ 
  isInitialized, 
  currentPrice, 
  loading, 
  slot0Raw, 
  poolKey, 
  poolError,
  onInitialize, 
  onRefresh 
}: PoolInfoProps) {
  const [showDebug, setShowDebug] = useState(false);

  // Compute poolId for Etherscan link
  const poolId = poolKey ? 
    '0x' + [...poolKey.currency0.slice(2).toLowerCase().padStart(64, '0')]
      .map((c, i) => {
        // Simple keccak would be better but this is for display
        return c;
      }).join('').slice(0, 64) : '';

  return (
    <div className={`rounded-xl border-2 p-4 ${isInitialized ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isInitialized ? 'bg-green-100' : 'bg-yellow-100'}`}>
          {isInitialized ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">{isInitialized ? 'Pool Active' : 'Pool Not Found'}</h3>
          {isInitialized ? (
            <p className="text-sm text-gray-600">Price: {currentPrice.toFixed(6)}</p>
          ) : (
            <p className="text-xs text-gray-500">
              {poolError?.includes('reverted') ? 'RPC call reverted - pool may not exist' : 'Checking...'}
            </p>
          )}
        </div>
        <button onClick={onRefresh} disabled={loading} className="p-2 hover:bg-white/50 rounded">
          <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Pool Key Debug Info */}
      {poolKey && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-medium text-gray-500">Pool Key</span>
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showDebug ? 'Hide' : 'Show'} Details
            </button>
          </div>
          
          {showDebug && (
            <div className="space-y-1 text-xs font-mono text-gray-600 bg-gray-50 p-2 rounded">
              <p className="break-all">currency0: {poolKey.currency0}</p>
              <p className="break-all">currency1: {poolKey.currency1}</p>
              <p>fee: {poolKey.fee}</p>
              <p>tickSpacing: {poolKey.tickSpacing.toString()}</p>
              <p className="break-all">hooks: {poolKey.hooks}</p>
              {poolError && (
                <p className="text-red-500 break-all mt-2">Error: {poolError}</p>
              )}
            </div>
          )}

          {/* Etherscan Link */}
          <a 
            href={`https://sepolia.etherscan.io/address/0xE03A1074c86CFeDd5C142C4F04F1a1536e203543#readContract`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Check on Etherscan
          </a>
        </div>
      )}

      {!isInitialized && (
        <div className="mt-3 space-y-2">
          <button
            onClick={onInitialize}
            disabled={loading}
            className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? <><Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Initializing...</> : 'Initialize Pool'}
          </button>
          
          <p className="text-xs text-gray-500 text-center">
            Pool must be initialized before adding liquidity
          </p>
        </div>
      )}
    </div>
  );
}
