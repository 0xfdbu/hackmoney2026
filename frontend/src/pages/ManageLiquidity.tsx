import React, { useState, useMemo } from 'react';
import { Plus, Loader2, AlertCircle, Check, RefreshCw, Shield } from 'lucide-react';
import { useAccount, useBalance, useWriteContract, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { 
  HOOK_ADDRESS, 
  POOL_MANAGER_ADDRESS, 
  VERIFIER_ADDRESS,
  TOKENS, 
  TICK_SPACINGS 
} from '../contracts/constants';

const POOL_MANAGER_ABI = [
  {
    inputs: [
      { components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ], name: 'key', type: 'tuple' },
      { name: 'sqrtPriceX96', type: 'uint160' }
    ],
    name: 'initialize',
    outputs: [{ name: 'tick', type: 'int24' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { components: [
        { name: 'currency0', type: 'address' },
        { name: 'currency1', type: 'address' },
        { name: 'fee', type: 'uint24' },
        { name: 'tickSpacing', type: 'int24' },
        { name: 'hooks', type: 'address' }
      ], name: 'key', type: 'tuple' }
    ],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' }
    ],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

const HOOK_ABI = [
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'getBatchInfo',
    outputs: [
      { name: 'commitmentCount', type: 'uint256' },
      { name: 'settled', type: 'bool' },
      { name: 'clearingPrice', type: 'uint256' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'currentBatchId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [{ name: 'clearingPrice', type: 'uint256' }],
    name: 'settleBatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

type TokenKey = keyof typeof TOKENS;

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  
  const [activeTab, setActiveTab] = useState<'liquidity' | 'darkpool'>('liquidity');
  const [t0, setT0] = useState<TokenKey>('ETH');
  const [t1, setT1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState('');

  // Sort tokens for pool key (currency0 < currency1)
  const poolKey = useMemo(() => {
    const addr0 = TOKENS[t0].address.toLowerCase();
    const addr1 = TOKENS[t1].address.toLowerCase();
    const [c0, c1] = addr0 < addr1 ? [t0, t1] : [t1, t0];
    
    return {
      currency0: TOKENS[c0].address as `0x${string}`,
      currency1: TOKENS[c1].address as `0x${string}`,
      fee,
      tickSpacing: BigInt(TICK_SPACINGS[fee]),
      hooks: HOOK_ADDRESS as `0x${string}`,
    };
  }, [t0, t1, fee]);

  // Check pool initialization
  const { data: slot0, refetch: refetchPool } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: [poolKey],
    query: { enabled: isConnected },
  });

  const isInitialized = !!slot0 && slot0[0] !== 0n;

  // DarkPool batch info
  const { data: currentBatchId } = useReadContract({
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

  // Balances
  const { data: bal0 } = useBalance({ 
    address, 
    token: TOKENS[t0].isNative ? undefined : TOKENS[t0].address as `0x${string}` 
  });
  const { data: bal1 } = useBalance({ 
    address, 
    token: TOKENS[t1].isNative ? undefined : TOKENS[t1].address as `0x${string}` 
  });

  const { writeContract, isPending } = useWriteContract();

  // Initialize Pool
  const handleInit = async () => {
    if (!isConnected) return;
    setLoading('init');
    setError('');
    
    try {
      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, 79228162514264337593543950336n],
      }, {
        onSuccess: () => {
          setSuccess('Pool initialized with DarkPool hook!');
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
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading('');
    }
  };

  // Settle Batch
  const handleSettleBatch = async () => {
    if (!slot0) return;
    setLoading('settle');
    
    try {
      await writeContract({
        address: HOOK_ADDRESS,
        abi: HOOK_ABI,
        functionName: 'settleBatch',
        args: [slot0[0]],
      }, {
        onSuccess: () => {
          setSuccess('Batch settled! All ZK swaps executed.');
          refetchBatch();
          setLoading('');
        },
        onError: (err: Error) => {
          setError(err.message?.slice(0, 100));
          setLoading('');
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLoading('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Manage DarkPool</h1>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => setActiveTab('liquidity')} 
          className={`flex-1 py-2 rounded-lg font-medium ${activeTab==='liquidity'?'bg-blue-600 text-white':'bg-gray-100'}`}
        >
          <Plus className="w-4 h-4 inline mr-1"/> Pool Setup
        </button>
        <button 
          onClick={() => setActiveTab('darkpool')} 
          className={`flex-1 py-2 rounded-lg font-medium ${activeTab==='darkpool'?'bg-purple-600 text-white':'bg-gray-100'}`}
        >
          <Shield className="w-4 h-4 inline mr-1"/> Batches
        </button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
      {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

      {activeTab === 'liquidity' && (
        <div className="space-y-4">
          <div className={`p-4 rounded-lg border-2 ${isInitialized ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
            <div className="flex items-center gap-2 font-bold">
              {isInitialized ? <Check className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
              <span>{isInitialized ? 'Pool Active' : 'Pool Not Initialized'}</span>
              <button onClick={() => refetchPool()} className="ml-auto">
                <RefreshCw className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            {isInitialized && (
              <p className="text-sm text-gray-600 mt-1">
                Hook: {HOOK_ADDRESS.slice(0, 6)}...{HOOK_ADDRESS.slice(-4)} | 
                Price: {(Number(slot0[0]) / 2**96).toFixed(4)}
              </p>
            )}
          </div>

          {!isInitialized && (
            <button 
              onClick={handleInit} 
              disabled={isPending || loading === 'init'}
              className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {loading === 'init' ? <><Loader2 className="w-4 h-4 inline animate-spin mr-2"/> Initializing...</> : 'Initialize DarkPool'}
            </button>
          )}

          <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded-xl shadow">
            <div>
              <label className="text-sm font-medium text-gray-700">Token 1</label>
              <select 
                value={t0} 
                onChange={(e) => setT0(e.target.value as TokenKey)} 
                className="w-full p-2 border rounded-lg mt-1"
              >
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Bal: {bal0 ? parseFloat(formatUnits(bal0.value, bal0.decimals)).toFixed(4) : '0'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Token 2</label>
              <select 
                value={t1} 
                onChange={(e) => setT1(e.target.value as TokenKey)} 
                className="w-full p-2 border rounded-lg mt-1"
              >
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Bal: {bal1 ? parseFloat(formatUnits(bal1.value, bal1.decimals)).toFixed(4) : '0'}
              </p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl shadow">
            <label className="text-sm font-medium text-gray-700 block mb-2">Fee Tier</label>
            <div className="flex gap-2">
              {[100, 500, 3000, 10000].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFee(f)} 
                  className={`flex-1 py-2 rounded-lg border ${fee===f?'bg-blue-50 border-blue-500 text-blue-700':'bg-white'}`}
                >
                  {f/10000}%
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'darkpool' && (
        <div className="space-y-4">
          <div className="bg-purple-50 p-6 rounded-xl border-2 border-purple-200">
            <h3 className="text-lg font-bold text-purple-900 mb-4">
              Current Batch #{currentBatchId?.toString() || '...'}
            </h3>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-700">{batchInfo?.[0].toString() || '0'}</p>
                <p className="text-xs text-purple-600">Commitments</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-700">{batchInfo?.[1] ? 'Closed' : 'Open'}</p>
                <p className="text-xs text-purple-600">Status</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-700">
                  {batchInfo?.[2] ? (Number(batchInfo[2]) / 2**96).toFixed(2) : '-'}
                </p>
                <p className="text-xs text-purple-600">Clearing Price</p>
              </div>
            </div>

            {!batchInfo?.[1] && (
              <button
                onClick={handleSettleBatch}
                disabled={isPending || loading === 'settle' || !batchInfo?.[0]}
                className="w-full py-3 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {loading === 'settle' ? (
                  <><Loader2 className="w-4 h-4 inline animate-spin mr-2"/> Settling...</>
                ) : (
                  'Settle Batch & Execute Swaps'
                )}
              </button>
            )}
            
            {batchInfo?.[1] && (
              <div className="text-center text-green-700 font-medium bg-green-100 p-2 rounded">
                ✓ Batch Settled
              </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-xl shadow text-sm text-gray-600">
            <h4 className="font-bold text-gray-800 mb-2">How DarkPool Works:</h4>
            <ol className="list-decimal list-inside space-y-1">
              <li>Users submit encrypted swap intents with ZK proofs</li>
              <li>Commitments accumulate in batch for 10 blocks</li>
              <li>Anyone can settle to execute all swaps at uniform price</li>
              <li>MEV-resistant: No front-running possible</li>
            </ol>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>Verifier: {VERIFIER_ADDRESS.slice(0, 6)}...{VERIFIER_ADDRESS.slice(-4)}</p>
            <p>Hook: {HOOK_ADDRESS.slice(0, 6)}...{HOOK_ADDRESS.slice(-4)}</p>
          </div>
        </div>
      )}
    </div>
  );
}