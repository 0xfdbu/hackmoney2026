import React, { useState, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { Plus, Minus, Shield, Droplets } from 'lucide-react';
import { parseUnits, formatUnits } from 'viem';
import { PoolSelector } from './PoolSelector';
import { PoolInfo } from './PoolInfo';
import { DarkPoolBatches } from './DarkPoolBatches';
import { POOL_MANAGER_ABI, HOOK_ABI, ERC20_ABI } from './abis';
import {
  HOOK_ADDRESS,
  POOL_MANAGER_ADDRESS,
  TOKENS,
  TICK_SPACINGS,
} from '../../contracts/constants';
import type { TokenKey, TabType } from './types';

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const { writeContract, isPending } = useWriteContract();

  // Simple state
  const [activeTab, setActiveTab] = useState<TabType>('add');
  const [token0, setToken0] = useState<TokenKey>('ETH');
  const [token1, setToken1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Build pool key
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

  // Fetch pool data with error handling
  const { data: slot0, refetch: refetchPool, error: poolError, isLoading: poolLoading } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: [poolKey],
    query: { enabled: isConnected, retry: false },
  });

  // Debug: log pool state
  console.log('Pool check:', {
    poolKey,
    slot0,
    sqrtPriceX96: slot0?.[0]?.toString(),
    poolError: poolError?.message,
    isLoading: poolLoading
  });

  const isInitialized = !!slot0 && slot0[0] !== undefined && slot0[0] !== 0n;
  const currentPrice = slot0?.[0] ? Math.pow(Number(slot0[0]) / 2**96, 2) : 1;

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

  const handleInitialize = async () => {
    if (!isConnected) return;
    setLoading(true);
    try {
      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, 79228162514264337593543950336n],
      }, {
        onSuccess: () => {
          setMessage('Pool initialized!');
          refetchPool();
          setLoading(false);
        },
        onError: (err: Error) => {
          setMessage(err.message?.includes('AlreadyInitialized') ? 'Pool already exists' : err.message?.slice(0, 100));
          setLoading(false);
        },
      });
    } catch (e) {
      setMessage('Failed to initialize');
      setLoading(false);
    }
  };

  const handleAddLiquidity = async () => {
    if (!address || !amount0 || !amount1) return;
    setLoading(true);
    try {
      const amt0 = parseUnits(amount0, TOKENS[token0].decimals);
      const amt1 = parseUnits(amount1, TOKENS[token1].decimals);

      // Approve tokens
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

      // Calculate liquidity (simplified)
      const liquidity = BigInt(Math.floor(Math.sqrt(parseFloat(amount0) * parseFloat(amount1)) * 1e6));

      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'modifyLiquidity',
        args: [
          poolKey,
          { tickLower: -60, tickUpper: 60, liquidityDelta: liquidity, salt: `0x${address.slice(2).padStart(64, '0')}` as `0x${string}` },
          '0x',
        ],
        value: TOKENS[token0].isNative ? amt0 : TOKENS[token1].isNative ? amt1 : 0n,
      }, {
        onSuccess: () => {
          setMessage('Liquidity added!');
          setAmount0('');
          setAmount1('');
          setLoading(false);
        },
        onError: (err: Error) => {
          setMessage(err.message?.slice(0, 100));
          setLoading(false);
        },
      });
    } catch (e) {
      setMessage('Failed to add liquidity');
      setLoading(false);
    }
  };

  const handleSettleBatch = async () => {
    if (!slot0) return;
    setLoading(true);
    await writeContract({
      address: HOOK_ADDRESS,
      abi: HOOK_ABI,
      functionName: 'settleBatch',
      args: [slot0[0]],
    }, {
      onSuccess: () => {
        setMessage('Batch settled!');
        refetchBatch();
        setLoading(false);
      },
      onError: () => setLoading(false),
    });
  };

  const handleTokenChange = (t0: TokenKey, t1: TokenKey) => {
    setToken0(t0);
    setToken1(t1);
    setAmount0('');
    setAmount1('');
    setMessage('');
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Liquidity</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('!') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      <PoolSelector
        token0={token0}
        token1={token1}
        fee={fee}
        onToken0Change={(t) => handleTokenChange(t, token1)}
        onToken1Change={(t) => handleTokenChange(token0, t)}
        onFeeChange={setFee}
        onSwapTokens={() => handleTokenChange(token1, token0)}
      />

      <div className="mt-4">
        <PoolInfo
          isInitialized={isInitialized}
          currentPrice={currentPrice}
          loading={loading || poolLoading}
          slot0Raw={slot0}
          poolKey={poolKey}
          poolError={poolError?.message}
          onInitialize={handleInitialize}
          onRefresh={async () => {
            const result = await refetchPool();
            console.log('Refetch result:', result);
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mt-6 mb-4">
        {[
          { id: 'add', icon: Plus, label: 'Add' },
          { id: 'remove', icon: Minus, label: 'Remove' },
          { id: 'darkpool', icon: Shield, label: 'Batches' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
            className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
              activeTab === id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Add Liquidity */}
      {activeTab === 'add' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {!isInitialized ? (
            <div className="text-center text-gray-500 py-8">
              <Droplets className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Initialize pool first</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">Current price: {currentPrice.toFixed(6)}</p>
              
              <input
                type="number"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                placeholder={`${TOKENS[token0].symbol} amount`}
                className="w-full p-3 border rounded-lg"
              />
              
              <input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder={`${TOKENS[token1].symbol} amount`}
                className="w-full p-3 border rounded-lg"
              />

              <button
                onClick={handleAddLiquidity}
                disabled={isPending || loading || !amount0 || !amount1}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading ? 'Adding...' : 'Add Liquidity'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Remove Liquidity */}
      {activeTab === 'remove' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center text-gray-500">
          <p>Remove liquidity coming soon</p>
        </div>
      )}

      {/* DarkPool Batches */}
      {activeTab === 'darkpool' && (
        <DarkPoolBatches
          currentBatchId={currentBatchId}
          batchInfo={batchInfo}
          onSettle={handleSettleBatch}
          loading={loading}
        />
      )}
    </div>
  );
}
