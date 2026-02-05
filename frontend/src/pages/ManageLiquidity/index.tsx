import React, { useState, useMemo, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useConfig } from 'wagmi';
import { waitForTransactionReceipt } from 'wagmi/actions';
import { Shield, Droplets, RefreshCw, ExternalLink, CheckCircle, AlertCircle, Wallet, Plus, Loader2, X } from 'lucide-react';
import { parseUnits, formatUnits, keccak256, encodeAbiParameters, parseAbiParameters, toBytes, concat, pad } from 'viem';
import { PoolSelector } from './PoolSelector';
import { DarkPoolBatches } from './DarkPoolBatches';
import { POOL_MANAGER_ABI, HOOK_ABI } from './abis';
import { POSITION_MANAGER_ABI, PERMIT2_ABI, ERC20_ABI, ACTIONS, POSITION_MANAGER_ADDRESS, PERMIT2_ADDRESS } from '../../contracts/positionManager';
import {
  HOOK_ADDRESS,
  POOL_MANAGER_ADDRESS,
  TOKENS,
  TICK_SPACINGS,
} from '../../contracts/constants';
import type { TokenKey, PoolKey } from './types';

// Transaction Progress Modal
type TxStep = {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  hash?: `0x${string}`;
};

function TransactionModal({ 
  isOpen, 
  onClose, 
  title, 
  steps, 
  error 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  title: string; 
  steps: TxStep[]; 
  error?: string;
}) {
  if (!isOpen) return null;
  
  const allSuccess = steps.length > 0 && steps.every(s => s.status === 'success');
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="space-y-3">
          {steps.map((step, idx) => (
            <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                step.status === 'success' ? 'bg-green-100 text-green-600' :
                step.status === 'error' ? 'bg-red-100 text-red-600' :
                step.status === 'loading' ? 'bg-blue-100 text-blue-600' :
                'bg-gray-200 text-gray-400'
              }`}>
                {step.status === 'success' ? <CheckCircle className="w-5 h-5" /> :
                 step.status === 'error' ? <AlertCircle className="w-5 h-5" /> :
                 step.status === 'loading' ? <Loader2 className="w-5 h-5 animate-spin" /> :
                 <span className="text-sm font-medium">{idx + 1}</span>
                }
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${
                  step.status === 'pending' ? 'text-gray-500' : 'text-gray-900'
                }`}>{step.label}</p>
                {step.hash && (
                  <a 
                    href={`https://sepolia.etherscan.io/tx/${step.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    View on Etherscan <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        
        {allSuccess && (
          <button
            onClick={onClose}
            className="w-full mt-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
          >
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// Compute poolId from poolKey
function computePoolId(poolKey: PoolKey): `0x${string}` {
  const encoded = encodeAbiParameters(
    parseAbiParameters('address, address, uint24, int24, address'),
    [poolKey.currency0, poolKey.currency1, poolKey.fee, Number(poolKey.tickSpacing), poolKey.hooks]
  );
  return keccak256(encoded);
}

// Compute pool state storage slot
function getPoolStateSlot(poolId: `0x${string}`): `0x${string}` {
  const POOLS_SLOT = 6n;
  const encoded = concat([toBytes(poolId), toBytes(POOLS_SLOT, { size: 32 })]);
  return keccak256(encoded);
}

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const config = useConfig();
  const { writeContract, writeContractAsync, isPending, data: hash, error: writeError } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  // UI State
  const [token0, setToken0] = useState<TokenKey>('ETH');
  const [token1, setToken1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);
  const [activeTab, setActiveTab] = useState<'liquidity' | 'darkpool'>('liquidity');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // Transaction Modal State
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [txSteps, setTxSteps] = useState<TxStep[]>([]);
  const [txError, setTxError] = useState<string>('');
  const [txTitle, setTxTitle] = useState('');

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

  // Compute poolId
  const poolId = useMemo(() => computePoolId(poolKey), [poolKey]);
  const poolStateSlot = useMemo(() => getPoolStateSlot(poolId), [poolId]);

  // Check pool state
  const { data: poolStateData, refetch: refetchPool, isLoading: poolLoading } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'extsload',
    args: [poolStateSlot],
    query: { enabled: isConnected, retry: false },
  });

  const sqrtPriceX96 = poolStateData ? BigInt(poolStateData) & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF') : 0n;
  const isInitialized = sqrtPriceX96 !== 0n;
  const currentPrice = isInitialized ? Math.pow(Number(sqrtPriceX96) / 2**96, 2) : 0;

  // Check Permit2 allowances with refetch
  const { data: permit2Allowance0, refetch: refetchAllowance0 } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address && !TOKENS[token0].isNative ? [address, TOKENS[token0].address as `0x${string}`, POSITION_MANAGER_ADDRESS] : undefined,
    query: { enabled: isConnected && !TOKENS[token0].isNative },
  });

  const { data: permit2Allowance1, refetch: refetchAllowance1 } = useReadContract({
    address: PERMIT2_ADDRESS,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: address && !TOKENS[token1].isNative ? [address, TOKENS[token1].address as `0x${string}`, POSITION_MANAGER_ADDRESS] : undefined,
    query: { enabled: isConnected && !TOKENS[token1].isNative },
  });

  // Fetch batch data
  const { data: currentBatchId, refetch: refetchBatch } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'currentBatchId',
  });

  const { data: batchInfo } = useReadContract({
    address: HOOK_ADDRESS,
    abi: HOOK_ABI,
    functionName: 'getBatchInfo',
    args: currentBatchId ? [currentBatchId] : undefined,
  });

  const loading = isPending || isConfirming || poolLoading;

  // Debug logging for allowances
  useEffect(() => {
    console.log('=== Allowance Debug ===');
    console.log('Token0:', token0, 'isNative:', TOKENS[token0].isNative);
    console.log('Token1:', token1, 'isNative:', TOKENS[token1].isNative);
    console.log('permit2Allowance0:', permit2Allowance0);
    console.log('permit2Allowance1:', permit2Allowance1);
    console.log('needsApproval0:', !TOKENS[token0].isNative && amount0 && (!permit2Allowance0 || permit2Allowance0[0] === 0n));
    console.log('needsApproval1:', !TOKENS[token1].isNative && amount1 && (!permit2Allowance1 || permit2Allowance1[0] === 0n));
    console.log('=======================');
  }, [permit2Allowance0, permit2Allowance1, token0, token1, amount0, amount1]);

  useEffect(() => {
    if (writeError) {
      console.error('Write error:', writeError);
      setError(writeError.message?.slice(0, 200) || 'Transaction failed');
      setMessage('');
    }
  }, [writeError]);

  // Refetch allowances when modal closes
  useEffect(() => {
    if (!txModalOpen) {
      console.log('Modal closed, refetching allowances...');
      refetchAllowance0();
      refetchAllowance1();
    }
  }, [txModalOpen, refetchAllowance0, refetchAllowance1]);

  const handleInitialize = async () => {
    if (!isConnected) return;
    setMessage('Initializing pool...');
    setError('');
    try {
      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, 79228162514264337593543950336n],
      });
    } catch (e) {
      setMessage('');
    }
  };

  // Check if we need Permit2 approvals (simplified - just check if any allowance exists)
  const needsApproval0 = !TOKENS[token0].isNative && amount0 && (!permit2Allowance0 || permit2Allowance0[0] === 0n);
  const needsApproval1 = !TOKENS[token1].isNative && amount1 && (!permit2Allowance1 || permit2Allowance1[0] === 0n);

  const handleApproveToken = async (token: TokenKey, amount: string) => {
    if (!amount) return;
    setError('');
    setTxTitle(`Approve ${TOKENS[token].symbol}`);
    setTxError('');
    setTxModalOpen(true);
    
    const tokenAddress = TOKENS[token].address as `0x${string}`;
    const amt = parseUnits(amount, TOKENS[token].decimals);
    const thirtyDaysFromNow = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
    
    setTxSteps([
      { id: 'erc20', label: `Approve ERC20 for Permit2`, status: 'loading' },
      { id: 'permit2', label: `Approve Permit2 for PositionManager`, status: 'pending' },
    ]);
    
    try {
      // Step 1: Approve ERC20 for Permit2
      const hash1 = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, amt * 2n],
      });
      
      setTxSteps(prev => prev.map(s => s.id === 'erc20' ? { ...s, hash: hash1, status: 'loading' } : s));
      
      // Wait for confirmation
      await waitForTransactionReceipt(config, { hash: hash1 });
      
      setTxSteps(prev => prev.map(s => s.id === 'erc20' ? { ...s, status: 'success' } : 
                                         s.id === 'permit2' ? { ...s, status: 'loading' } : s));
      
      // Step 2: Approve Permit2 for PositionManager
      const hash2 = await writeContractAsync({
        address: PERMIT2_ADDRESS,
        abi: PERMIT2_ABI,
        functionName: 'approve',
        args: [tokenAddress, POSITION_MANAGER_ADDRESS, amt * 2n, thirtyDaysFromNow],
      });
      
      setTxSteps(prev => prev.map(s => s.id === 'permit2' ? { ...s, hash: hash2, status: 'loading' } : s));
      
      await waitForTransactionReceipt(config, { hash: hash2 });
      
      setTxSteps(prev => prev.map(s => s.id === 'permit2' ? { ...s, status: 'success' } : s));
      setMessage(`${TOKENS[token].symbol} approved! You can now add liquidity.`);
      
      // Refetch allowances
      if (token === token0) await refetchAllowance0();
      else await refetchAllowance1();
      
    } catch (e: any) {
      setTxError(e.message || 'Transaction failed');
      setTxSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
    }
  };

  const handleAddLiquidity = async () => {
    if (!address || !amount0 || !amount1 || !isInitialized) return;
    
    setError('');
    setTxTitle('Add Liquidity');
    setTxError('');
    setTxModalOpen(true);
    
    try {
      const amt0 = parseUnits(amount0, TOKENS[token0].decimals);
      const amt1 = parseUnits(amount1, TOKENS[token1].decimals);
      
      // Calculate ticks - must be within [-887272, 887272] and aligned to tickSpacing
      const tickSpacing = TICK_SPACINGS[fee];
      // Note: In Solidity, integer division truncates toward zero
      // -887272 / 60 = -14787, -14787 * 60 = -887220
      const tickLower = -887220;
      const tickUpper = 887220;
      
      // Calculate liquidity (uint128)
      const amount0Num = parseFloat(amount0);
      const amount1Num = parseFloat(amount1);
      const liquidity = BigInt(Math.floor(Math.sqrt(amount0Num * amount1Num) * 1e12)) & BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF');

      // Determine which amount is for which token based on pool ordering
      // poolKey.currency0/currency1 are sorted by address
      // We need to map user input amounts (token0/token1) to pool ordering (currency0/currency1)
      const token0Address = TOKENS[token0].address.toLowerCase();
      const token1Address = TOKENS[token1].address.toLowerCase();
      const currency0Address = poolKey.currency0.toLowerCase();
      const currency1Address = poolKey.currency1.toLowerCase();
      
      // Map amounts to currency ordering
      const poolAmt0 = token0Address === currency0Address ? amt0 : amt1;
      const poolAmt1 = token0Address === currency1Address ? amt0 : amt1;
      
      // Use larger max amounts for slippage protection (10x the input amounts)
      const poolAmt0Max = poolAmt0 * 10n;
      const poolAmt1Max = poolAmt1 * 10n;
      
      // Check if ETH is involved and handle accordingly
      const hasNativeEth = TOKENS[token0].isNative || TOKENS[token1].isNative;
      const nativeAmount = TOKENS[token0].isNative ? amt0 : TOKENS[token1].isNative ? amt1 : 0n;
      
      setTxSteps([
        { id: 'mint', label: `Mint liquidity position`, status: 'loading' },
      ]);

      // Build unlockData following Uniswap v4 PositionManager spec
      // Use CLOSE_CURRENCY (0x12) instead of SETTLE_PAIR - it auto-settles deltas
      
      // Encode packed action IDs: MINT_POSITION (0x02) + CLOSE_CURRENCY (0x12) x2
      const actionsHex = `0x021212` as `0x${string}`;
      
      // Encode mint position parameters
      const mintParams = encodeAbiParameters(
        parseAbiParameters('(address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks), int24, int24, uint128, uint128, uint128, address, bytes'),
        [
          [poolKey.currency0, poolKey.currency1, poolKey.fee, Number(poolKey.tickSpacing), poolKey.hooks],
          tickLower,
          tickUpper,
          liquidity,
          poolAmt0Max,
          poolAmt1Max,
          address,
          '0x'
        ]
      );
      
      // Encode close currency params for both tokens (no params needed)
      const closeParams0 = encodeAbiParameters(
        parseAbiParameters('address'),
        [poolKey.currency0]
      );
      const closeParams1 = encodeAbiParameters(
        parseAbiParameters('address'),
        [poolKey.currency1]
      );
      
      // Build unlockData: abi.encode(actions, params)
      const unlockData = encodeAbiParameters(
        parseAbiParameters('bytes, bytes[]'),
        [actionsHex, [mintParams, closeParams0, closeParams1]]
      );
      
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600); // 10 minutes
      
      console.log('Mint params:', {
        token0,
        token1,
        token0Address,
        token1Address,
        currency0Address,
        currency1Address,
        amt0: amt0.toString(),
        amt1: amt1.toString(),
        poolAmt0: poolAmt0.toString(),
        poolAmt1: poolAmt1.toString(),
        poolKey,
        tickLower,
        tickUpper,
        liquidity: liquidity.toString(),
        recipient: address,
        deadline,
        nativeAmount: nativeAmount.toString(),
        actions: actionsHex,
      });

      // Call PositionManager.modifyLiquidities()
      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS,
        abi: POSITION_MANAGER_ABI,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value: nativeAmount,
      });
      
      setTxSteps([{ id: 'mint', label: 'Mint liquidity position', status: 'loading', hash }]);
      
      // Wait for confirmation with retry logic
      let receipt = null;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      
      while (!receipt && attempts < maxAttempts) {
        try {
          receipt = await waitForTransactionReceipt(config, { hash });
        } catch (e) {
          // Receipt not found yet, wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
          console.log(`Waiting for receipt... attempt ${attempts}`);
        }
      }
      
      if (!receipt) {
        throw new Error('Transaction submitted but receipt not found. Check Etherscan for status.');
      }
      
      setTxSteps([{ id: 'mint', label: 'Mint liquidity position', status: 'success', hash }]);
      setMessage('Liquidity added successfully!');
      setAmount0('');
      setAmount1('');
      
      // Auto close after 2 seconds
      setTimeout(() => setTxModalOpen(false), 2000);
    } catch (e: any) {
      console.error('Add liquidity error:', e);
      console.error('Error details:', {
        message: e.message,
        shortMessage: e.shortMessage,
        details: e.details,
        revertReason: e.revertReason,
        cause: e.cause,
      });
      // Check if it's a "receipt not found" error but tx was submitted
      if (e.message?.includes('Transaction receipt') && e.message?.includes('could not be found')) {
        setTxError('Transaction submitted! Waiting for confirmation may take longer. Check Etherscan for status.');
      } else if (e.message?.includes('reverted') || e.message?.includes('Execution reverted')) {
        setTxError('Transaction reverted. The PositionManager requires Permit2 signatures which are not fully implemented. Try using app.uniswap.org for liquidity instead.');
      } else {
        setTxError(e.shortMessage || e.message || 'Transaction failed');
      }
      setTxSteps(prev => prev.map(s => s.status === 'loading' ? { ...s, status: 'error' } : s));
      setMessage('');
    }
  };

  const handleSettleBatch = async () => {
    if (!sqrtPriceX96) return;
    setMessage('Settling batch...');
    setError('');
    try {
      await writeContract({
        address: HOOK_ADDRESS,
        abi: HOOK_ABI,
        functionName: 'settleBatch',
        args: [sqrtPriceX96],
      });
    } catch (e) {
      setMessage('');
    }
  };

  const handleTokenChange = (t0: TokenKey, t1: TokenKey) => {
    setToken0(t0);
    setToken1(t1);
    setAmount0('');
    setAmount1('');
    setMessage('');
    setError('');
  };

  // Success message after transaction confirms
  React.useEffect(() => {
    if (hash && !isConfirming) {
      setMessage('✓ Transaction confirmed!');
      setError('');
      refetchPool();
      refetchBatch();
    }
  }, [hash, isConfirming, refetchPool, refetchBatch]);

  return (
    <div className="max-w-xl mx-auto p-4">
      {/* Transaction Progress Modal */}
      <TransactionModal
        isOpen={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        title={txTitle}
        steps={txSteps}
        error={txError}
      />
      
      <h1 className="text-2xl font-bold mb-6">Manage Liquidity</h1>

      {/* Status Banner */}
      {message && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-green-50 text-green-700 border border-green-200">
          {message}
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          <p className="font-medium">Error:</p>
          <p className="text-xs break-all">{error}</p>
        </div>
      )}

      {/* Pool Selector */}
      <PoolSelector
        token0={token0}
        token1={token1}
        fee={fee}
        onToken0Change={(t) => handleTokenChange(t, token1)}
        onToken1Change={(t) => handleTokenChange(token0, t)}
        onFeeChange={setFee}
        onSwapTokens={() => handleTokenChange(token1, token0)}
      />

      {/* Pool Status Card */}
      <div className={`mt-4 rounded-xl border-2 p-4 ${isInitialized ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isInitialized ? 'bg-green-100' : 'bg-yellow-100'}`}>
            {isInitialized ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertCircle className="w-5 h-5 text-yellow-600" />}
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-gray-800">
              {isInitialized ? 'Pool Active' : 'Pool Not Initialized'}
            </h3>
            {isInitialized && (
              <p className="text-sm text-gray-600">
                Price: {currentPrice.toFixed(6)}
              </p>
            )}
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {poolKey.currency0.slice(0, 6)}...{poolKey.currency0.slice(-4)} / {poolKey.currency1.slice(0, 6)}...{poolKey.currency1.slice(-4)}
            </p>
          </div>
          <button onClick={() => refetchPool()} disabled={loading} className="p-2 hover:bg-white/50 rounded">
            <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {!isInitialized && (
          <div className="mt-4 pt-4 border-t border-yellow-200">
            <p className="text-sm text-gray-600 mb-2">
              This pool needs to be initialized before you can add liquidity.
            </p>
            <p className="text-xs text-gray-500 mb-3">
              Token pair: {TOKENS[token0].symbol} / {TOKENS[token1].symbol}
            </p>
            <button
              onClick={handleInitialize}
              disabled={loading}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium"
            >
              {loading ? 'Initializing...' : 'Initialize Pool'}
            </button>
          </div>
        )}
      </div>

      {/* Main Content */}
      {isInitialized ? (
        <>
          {/* Tabs */}
          <div className="flex gap-2 mt-6 mb-4">
            <button
              onClick={() => setActiveTab('liquidity')}
              className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                activeTab === 'liquidity' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Plus className="w-4 h-4" />
              Add Liquidity
            </button>
            <button
              onClick={() => setActiveTab('darkpool')}
              className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
                activeTab === 'darkpool' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Shield className="w-4 h-4" />
              DarkPool
            </button>
          </div>

          {/* Add Liquidity Panel */}
          {activeTab === 'liquidity' && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <h3 className="font-semibold flex items-center gap-2 mb-4">
                <Wallet className="w-5 h-5 text-blue-600" />
                Add Liquidity
              </h3>

              <div className="space-y-3">
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                  <p>Price: <span className="font-mono">{currentPrice.toFixed(6)}</span> | Range: Full</p>
                </div>

                {/* Token 0 Input */}
                <div>
                  <div className="flex justify-between">
                    <label className="text-sm text-gray-600">{TOKENS[token0].symbol}</label>
                    {needsApproval0 && (
                      <button
                        onClick={() => handleApproveToken(token0, amount0)}
                        disabled={!amount0 || loading}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Approve Permit2
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0.0"
                    className="w-full p-3 border rounded-lg"
                    step="0.001"
                  />
                </div>

                {/* Token 1 Input */}
                <div>
                  <div className="flex justify-between">
                    <label className="text-sm text-gray-600">{TOKENS[token1].symbol}</label>
                    {needsApproval1 && (
                      <button
                        onClick={() => handleApproveToken(token1, amount1)}
                        disabled={!amount1 || loading}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Approve Permit2
                      </button>
                    )}
                  </div>
                  <input
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0.0"
                    className="w-full p-3 border rounded-lg"
                    step="0.001"
                  />
                </div>

                <button
                  onClick={handleAddLiquidity}
                  disabled={loading || !amount0 || !amount1 || needsApproval0 || needsApproval1}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Add Liquidity'}
                </button>

                {/* Allowance Status Debug */}
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded space-y-1">
                  <div className="flex justify-between">
                    <span>{TOKENS[token0].symbol} Permit2:</span>
                    <span className={permit2Allowance0 && permit2Allowance0[0] > 0n ? 'text-green-600' : 'text-red-600'}>
                      {permit2Allowance0 && permit2Allowance0[0] > 0n ? '✓ Approved' : '✗ Not Approved'}
                    </span>
                  </div>
                  {!TOKENS[token1].isNative && (
                    <div className="flex justify-between">
                      <span>{TOKENS[token1].symbol} Permit2:</span>
                      <span className={permit2Allowance1 && permit2Allowance1[0] > 0n ? 'text-green-600' : 'text-red-600'}>
                        {permit2Allowance1 && permit2Allowance1[0] > 0n ? '✓ Approved' : '✗ Not Approved'}
                      </span>
                    </div>
                  )}
                  <button
                    onClick={() => { refetchAllowance0(); refetchAllowance1(); }}
                    className="w-full mt-1 text-xs text-blue-600 hover:text-blue-800 py-1"
                  >
                    Refresh Allowances
                  </button>
                </div>

                {(needsApproval0 || needsApproval1) && (
                  <p className="text-xs text-orange-600 text-center">
                    Please approve tokens for Permit2 first
                  </p>
                )}

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-yellow-800 mb-1">⚠️ Advanced Feature</p>
                  <p className="text-yellow-700 mb-2">
                    Adding liquidity requires Permit2 signatures. If this fails, use the 
                    <a href="https://app.uniswap.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Uniswap Interface</a>.
                  </p>
                </div>

                <a
                  href="https://docs.uniswap.org/contracts/v4/quickstart/manage-liquidity"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  <ExternalLink className="w-4 h-4" />
                  View Uniswap v4 Docs
                </a>
              </div>
            </div>
          )}

          {/* DarkPool Panel */}
          {activeTab === 'darkpool' && (
            <DarkPoolBatches
              currentBatchId={currentBatchId}
              batchInfo={batchInfo}
              onSettle={handleSettleBatch}
              loading={loading}
            />
          )}
        </>
      ) : (
        <div className="mt-6 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300 p-8 text-center">
          <Droplets className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <h3 className="font-semibold text-gray-700 mb-1">Pool Not Ready</h3>
          <p className="text-sm text-gray-500 mb-4">
            Initialize the pool above to enable liquidity management.
          </p>
          <button
            onClick={handleInitialize}
            disabled={loading}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-medium"
          >
            {loading ? 'Initializing...' : 'Initialize Now'}
          </button>
        </div>
      )}
    </div>
  );
}
