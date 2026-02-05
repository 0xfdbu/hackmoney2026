import React, { useState, useMemo } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { Droplets, Shield, Plus, Minus } from 'lucide-react';
import { useWriteContract } from 'wagmi';

import { PoolSelector } from './PoolSelector';
import { PoolInfo } from './PoolInfo';
import { AddLiquidityForm } from './AddLiquidityForm';
import { RemoveLiquidityForm } from './RemoveLiquidityForm';
import { DarkPoolBatches } from './DarkPoolBatches';
import { POOL_MANAGER_ABI, HOOK_ABI } from './abis';
import {
  HOOK_ADDRESS,
  POOL_MANAGER_ADDRESS,
  TOKENS,
  TICK_SPACINGS,
} from '../../contracts/constants';
import { TokenKey, TabType } from './types';

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('add');

  // Pool selection state
  const [token0, setToken0] = useState<TokenKey>('ETH');
  const [token1, setToken1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);

  // UI state
  const [loading, setLoading] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Build pool key (sorted by address)
  const poolKey = useMemo(() => {
    const addr0 = TOKENS[token0].address.toLowerCase();
    const addr1 = TOKENS[token1].address.toLowerCase();
    const [c0, c1] = addr0 < addr1 ? [token0, token1] : [token1, token0];

    return {
      currency0: TOKENS[c0].address as `0x${string}`,
      currency1: TOKENS[c1].address as `0x${string}`,
      fee,
      tickSpacing: BigInt(TICK_SPACINGS[fee]),
      hooks: HOOK_ADDRESS as `0x${string}`,
    };
  }, [token0, token1, fee]);

  // Fetch pool data
  const { data: slot0, refetch: refetchPool } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: [poolKey],
    query: { enabled: isConnected },
  });

  const isInitialized = !!slot0 && slot0[0] !== 0n;

  // Fetch batch data
  const { data: currentBatchId, refetch: refetchBatchId } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'currentBatchId',
  });

  const { data: batchInfo, refetch: refetchBatch } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'getBatchInfo',
    args: currentBatchId ? [currentBatchId] : undefined,
  });

  // Handlers
  const handleSwapTokens = () => {
    setToken0(token1);
    setToken1(token0);
  };

  const handleInitialize = async () => {
    if (!isConnected) return;
    setLoading('init');
    setError('');

    try {
      await writeContract(
        {
          address: POOL_MANAGER_ADDRESS,
          abi: POOL_MANAGER_ABI,
          functionName: 'initialize',
          args: [poolKey, 79228162514264337593543950336n], // sqrtPriceX96 = 1.0
        },
        {
          onSuccess: () => {
            setSuccess('Pool initialized successfully!');
            refetchPool();
            setLoading('');
          },
          onError: (err: Error) => {
            if (err.message?.includes('AlreadyInitialized')) {
              setSuccess('Pool already exists');
              refetchPool();
            } else {
              setError(err.message?.slice(0, 100));
            }
            setLoading('');
          },
        }
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading('');
    }
  };

  const handleRefresh = () => {
    refetchPool();
    refetchBatchId();
    refetchBatch();
  };

  const clearNotifications = () => {
    setError('');
    setSuccess('');
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Manage Liquidity</h1>
        <p className="text-gray-600">
          Add or remove liquidity and manage DarkPool batches
        </p>
      </div>

      {/* Notifications */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-xl text-sm border border-green-200">
          {success}
        </div>
      )}

      {/* Pool Selector */}
      <div className="mb-6">
        <PoolSelector
          token0={token0}
          token1={token1}
          fee={fee}
          onToken0Change={(t) => {
            setToken0(t);
            clearNotifications();
          }}
          onToken1Change={(t) => {
            setToken1(t);
            clearNotifications();
          }}
          onFeeChange={(f) => {
            setFee(f);
            clearNotifications();
          }}
          onSwapTokens={handleSwapTokens}
        />
      </div>

      {/* Pool Info */}
      <div className="mb-6">
        <PoolInfo
          isInitialized={isInitialized}
          sqrtPriceX96={slot0?.[0]}
          tick={slot0?.[1]}
          loading={loading === 'init'}
          onInitialize={handleInitialize}
          onRefresh={refetchPool}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'add'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Plus className="w-4 h-4" />
          Add Liquidity
        </button>
        <button
          onClick={() => setActiveTab('remove')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'remove'
              ? 'bg-white text-red-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Minus className="w-4 h-4" />
          Remove Liquidity
        </button>
        <button
          onClick={() => setActiveTab('darkpool')}
          className={`flex-1 py-2.5 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'darkpool'
              ? 'bg-white text-purple-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Shield className="w-4 h-4" />
          Batches
        </button>
      </div>

      {/* Tab Content */}
      <div className="space-y-4">
        {activeTab === 'add' && (
          <AddLiquidityForm
            poolKey={poolKey}
            token0={token0}
            token1={token1}
            fee={fee}
            isInitialized={isInitialized}
            onSuccess={() => {
              setSuccess('Liquidity added successfully!');
              handleRefresh();
            }}
          />
        )}

        {activeTab === 'remove' && (
          <RemoveLiquidityForm
            poolKey={poolKey}
            token0={token0}
            token1={token1}
            isInitialized={isInitialized}
            onSuccess={() => {
              setSuccess('Liquidity removed successfully!');
              handleRefresh();
            }}
          />
        )}

        {activeTab === 'darkpool' && (
          <DarkPoolBatches
            currentBatchId={currentBatchId}
            batchInfo={batchInfo}
            slot0SqrtPriceX96={slot0?.[0]}
            onSuccess={() => {
              setSuccess('Batch settled successfully!');
              handleRefresh();
            }}
          />
        )}
      </div>
    </div>
  );
}
