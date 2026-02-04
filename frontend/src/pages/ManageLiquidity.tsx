import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Minus, Loader2, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { useAccount, useBalance, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, maxInt256 } from 'viem';
import { Pool, Position } from '@uniswap/v4-sdk';
import { CurrencyAmount, Token, Ether, Currency } from '@uniswap/sdk-core';
import { ERC20_ABI, POOL_MANAGER_ABI } from '../contracts/abis';
import { TOKENS, TICK_SPACINGS, POOL_MANAGER_ADDRESS, HOOK_ADDRESS } from '../contracts/constants';

// !!! IMPORTANT: Add your Sepolia PositionManager address here !!!
// You can find it in the v4-periphery broadcast folder or deploy it yourself
const POSITION_MANAGER_ADDRESS = '0x1b1c77B618BC75296cda8fdEde3C20D03D3f6c61' as `0x${string}`;

type TokenKey = keyof typeof TOKENS;

// Helper to get SDK Currency
const getSdkCurrency = (tokenKey: TokenKey, chainId: number): Currency => {
  const token = TOKENS[tokenKey];
  if (token.isNative) {
    return Ether.onChain(chainId);
  }
  return new Token(chainId, token.address, token.decimals, token.symbol);
};

export default function ManageLiquidity() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();
  
  const [tab, setTab] = useState<'add' | 'remove'>('add');
  const [t0, setT0] = useState<TokenKey>('ETH');
  const [t1, setT1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);
  const [amt0, setAmt0] = useState('');
  const [amt1, setAmt1] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState('');
  const [txHash, setTxHash] = useState<string>('');

  const chainIdNumber = chainId || 11155111; // Default to Sepolia

  // Get sorted tokens and pool key
  const { currency0, currency1, poolKey, token0Key, token1Key } = useMemo(() => {
    const curr0 = getSdkCurrency(t0, chainIdNumber);
    const curr1 = getSdkCurrency(t1, chainIdNumber);
    
    // Sort tokens (currency0 < currency1)
    const [c0, c1, t0k, t1k] = curr0.sortsBefore(curr1) 
      ? [curr0, curr1, t0, t1] 
      : [curr1, curr0, t1, t0];
      
    const pKey = {
      currency0: c0.isNative ? '0x0000000000000000000000000000000000000000' : c0.address as `0x${string}`,
      currency1: c1.isNative ? '0x0000000000000000000000000000000000000000' : c1.address as `0x${string}`,
      fee,
      tickSpacing: BigInt(TICK_SPACINGS[fee]),
      hooks: HOOK_ADDRESS as `0x${string}`,
    };
    
    return { currency0: c0, currency1: c1, poolKey: pKey, token0Key: t0k, token1Key: t1k };
  }, [t0, t1, fee, chainIdNumber]);

  // Check if pool exists
  const { data: slot0, refetch: refetchPool } = useReadContract({
    address: POOL_MANAGER_ADDRESS,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: [poolKey],
    query: { enabled: isConnected },
  });

  const isInitialized = !!slot0 && slot0[0] !== 0n;

  // Balances (using original token keys for display)
  const { data: bal0 } = useBalance({ 
    address, 
    token: TOKENS[t0].isNative ? undefined : TOKENS[t0].address as `0x${string}` 
  });
  const { data: bal1 } = useBalance({ 
    address, 
    token: TOKENS[t1].isNative ? undefined : TOKENS[t1].address as `0x${string}` 
  });

  const { writeContract, isPending } = useWriteContract();
  const { writeContract: writeToken, isPending: isApproving } = useWriteContract();

  const resetState = () => {
    setError('');
    setSuccess('');
    setTxHash('');
  };

  // Initialize pool (direct to PoolManager)
  const handleInit = async () => {
    if (!isConnected) {
      setError('Connect wallet first');
      return;
    }
    
    resetState();
    setLoading('init');

    try {
      // 1:1 price = sqrt(1) * 2^96 = 2^96
      const sqrtPriceX96 = 79228162514264337593543950336n;
      
      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, sqrtPriceX96],
      }, {
        onSuccess: (hash) => {
          setTxHash(hash);
          setSuccess('Pool initialized successfully!');
          refetchPool();
          setLoading('');
        },
        onError: (err: any) => {
          const msg = err.message?.toLowerCase() || '';
          if (msg.includes('alreadyinitialized')) {
            setSuccess('Pool already exists!');
            refetchPool();
          } else {
            setError(err.message?.slice(0, 200) || 'Initialization failed');
          }
          setLoading('');
        }
      });
    } catch (e: any) {
      setError(e.message?.slice(0, 200) || 'Initialization failed');
      setLoading('');
    }
  };

  // Check and approve token for PositionManager
  const checkAndApprove = async (tokenKey: TokenKey, amount: bigint) => {
    if (TOKENS[tokenKey].isNative) return true;
    
    const allowance = await publicClient?.readContract({
      address: TOKENS[tokenKey].address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [address!, POSITION_MANAGER_ADDRESS],
    });

    if (!allowance || allowance < amount) {
      setLoading(`approve-${tokenKey}`);
      
      return new Promise<boolean>((resolve) => {
        writeToken({
          address: TOKENS[tokenKey].address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POSITION_MANAGER_ADDRESS, maxInt256], // Max approve for simplicity
        }, {
          onSuccess: () => {
            setLoading('');
            resolve(true);
          },
          onError: (err: any) => {
            setError(`Approval failed: ${err.message?.slice(0, 100)}`);
            setLoading('');
            resolve(false);
          }
        });
      });
    }
    return true;
  };

  // Add liquidity using SDK
  const handleAdd = async () => {
    if (!isConnected || !amt0 || !amt1) {
      setError('Enter amounts');
      return;
    }
    if (!isInitialized) {
      setError('Pool not initialized');
      return;
    }

    resetState();
    setLoading('add');

    try {
      // Parse amounts
      const amount0 = parseUnits(amt0, currency0.decimals);
      const amount1 = parseUnits(amt1, currency1.decimals);

      // Create SDK Pool instance (uses current slot0 if available)
      const pool = new Pool(
        currency0,
        currency1,
        fee,
        TICK_SPACINGS[fee],
        HOOK_ADDRESS,
        slot0?.[0].toString() || '79228162514264337593543950336',
        '0', // Liquidity - SDK will calculate
        Number(slot0?.[1] || 0) // Current tick
      );

      // Create Position (calculates liquidity, ticks, etc.)
      // Using a 10-tick range around current price for demo
      const tickSpacing = TICK_SPACINGS[fee];
      const tickLower = Math.floor((pool.tickCurrent - tickSpacing * 5) / tickSpacing) * tickSpacing;
      const tickUpper = Math.ceil((pool.tickCurrent + tickSpacing * 5) / tickSpacing) * tickSpacing;

      const position = Position.fromAmounts({
        pool,
        tickLower,
        tickUpper,
        amount0: amount0.toString(),
        amount1: amount1.toString(),
        useFullPrecision: true,
      });

      // Check approvals (approve PositionManager, not PoolManager)
      if (!currency0.isNative) {
        const approved = await checkAndApprove(token0Key, amount0);
        if (!approved) return;
      }
      if (!currency1.isNative) {
        const approved = await checkAndApprove(token1Key, amount1);
        if (!approved) return;
      }

      // Calculate ETH value to send
      const ethValue = currency0.isNative ? amount0 : currency1.isNative ? amount1 : 0n;

      // Call PositionManager.modifyLiquidity
      // This handles the lock pattern internally!
      await writeContract({
        address: POSITION_MANAGER_ADDRESS,
        abi: [
          {
            inputs: [
              {
                components: [
                  { name: 'currency0', type: 'address' },
                  { name: 'currency1', type: 'address' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'tickSpacing', type: 'int24' },
                  { name: 'hooks', type: 'address' }
                ],
                name: 'key',
                type: 'tuple'
              },
              {
                components: [
                  { name: 'tickLower', type: 'int24' },
                  { name: 'tickUpper', type: 'int24' },
                  { name: 'liquidityDelta', type: 'int128' },
                  { name: 'salt', type: 'bytes32' }
                ],
                name: 'params',
                type: 'tuple'
              },
              { name: 'hookData', type: 'bytes' }
            ],
            name: 'modifyLiquidity',
            outputs: [
              { name: 'callerDelta', type: 'int256' },
              { name: 'feesAccrued', type: 'int256' }
            ],
            stateMutability: 'payable',
            type: 'function'
          }
        ],
        functionName: 'modifyLiquidity',
        args: [
          poolKey,
          {
            tickLower: position.tickLower,
            tickUpper: position.tickUpper,
            liquidityDelta: BigInt(position.liquidity.toString()),
            salt: `0x${'0'.repeat(64)}` as `0x${string}`
          },
          '0x' // Empty hook data for add liquidity
        ],
        value: ethValue,
      }, {
        onSuccess: (hash) => {
          setTxHash(hash);
          setSuccess(`Added ${position.liquidity.toString()} liquidity units`);
          setAmt0('');
          setAmt1('');
          setLoading('');
        },
        onError: (err: any) => {
          console.error('Add liquidity error:', err);
          setError(err.message?.slice(0, 200) || 'Add liquidity failed');
          setLoading('');
        }
      });

    } catch (e: any) {
      console.error('Error:', e);
      setError(e.message?.slice(0, 200) || 'Transaction failed');
      setLoading('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Manage Liquidity (SDK)</h1>
      
      {/* Pool Status */}
      <div className={`mb-4 p-4 rounded-lg border-2 ${isInitialized ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            {isInitialized ? (
              <Check className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            )}
            <span className={isInitialized ? 'text-green-800' : 'text-yellow-800'}>
              {isInitialized ? 'Pool Active' : 'Pool Not Initialized'}
            </span>
          </div>
          <button onClick={() => refetchPool()} className="p-1 hover:bg-white rounded">
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
        {isInitialized && (
          <p className="text-sm text-gray-600 mt-1">
            Price: {(Number(slot0?.[0]) / 2**96).toFixed(6)} | 
            Tick: {slot0?.[1].toString()}
          </p>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 rounded-lg text-sm bg-green-100 text-green-700 border border-green-200">
          {success}
          {txHash && (
            <div className="mt-1 text-xs break-all">
              Tx: {txHash.slice(0, 20)}...{txHash.slice(-8)}
            </div>
          )}
        </div>
      )}

      {/* Initialize Button */}
      {!isInitialized && (
        <button 
          onClick={handleInit} 
          disabled={isPending || loading === 'init'}
          className="mb-6 w-full py-3 rounded-lg font-medium bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50"
        >
          {loading === 'init' ? (
            <><Loader2 className="w-4 h-4 inline animate-spin mr-2"/> Initializing...</>
          ) : (
            '1. Initialize Pool'
          )}
        </button>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button 
          onClick={() => setTab('add')} 
          className={`flex-1 py-2 rounded-lg font-medium ${tab==='add'?'bg-blue-600 text-white':'bg-gray-100'}`}
        >
          <Plus className="w-4 h-4 inline mr-1"/> Add
        </button>
        <button 
          onClick={() => setTab('remove')} 
          className={`flex-1 py-2 rounded-lg font-medium ${tab==='remove'?'bg-red-600 text-white':'bg-gray-100'}`}
        >
          <Minus className="w-4 h-4 inline mr-1"/> Remove
        </button>
      </div>

      {tab === 'add' && (
        <div className="space-y-4 bg-white p-6 rounded-xl shadow-lg border">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Token 1</label>
              <select 
                value={t0} 
                onChange={(e) => { setT0(e.target.value as TokenKey); setAmt0(''); setAmt1(''); }} 
                className="w-full p-2 border rounded-lg"
              >
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Balance: {bal0 ? parseFloat(formatUnits(bal0.value, bal0.decimals)).toFixed(4) : '0'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Token 2</label>
              <select 
                value={t1} 
                onChange={(e) => { setT1(e.target.value as TokenKey); setAmt0(''); setAmt1(''); }} 
                className="w-full p-2 border rounded-lg"
              >
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Balance: {bal1 ? parseFloat(formatUnits(bal1.value, bal1.decimals)).toFixed(4) : '0'}
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Fee Tier</label>
            <div className="flex gap-2">
              {[100, 500, 3000, 10000].map(f => (
                <button 
                  key={f} 
                  onClick={() => setFee(f)} 
                  className={`flex-1 py-2 rounded border text-sm font-medium ${fee===f?'bg-blue-50 border-blue-500 text-blue-700':'bg-white'}`}
                >
                  {f/10000}%
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <input 
              type="number" 
              step="any"
              value={amt0} 
              onChange={(e) => setAmt0(e.target.value)} 
              placeholder={`Amount ${t0}`} 
              className="w-full p-3 border rounded-lg"
              disabled={!isInitialized}
            />
            <input 
              type="number" 
              step="any"
              value={amt1} 
              onChange={(e) => setAmt1(e.target.value)} 
              placeholder={`Amount ${t1}`} 
              className="w-full p-3 border rounded-lg"
              disabled={!isInitialized}
            />
          </div>

          <button 
            onClick={handleAdd} 
            disabled={isPending || isApproving || !!loading || !isInitialized || !amt0 || !amt1}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {loading.startsWith('approve') ? (
              'Approving...'
            ) : isPending ? (
              <><Loader2 className="w-4 h-4 inline animate-spin mr-2"/> Adding...</>
            ) : !isInitialized ? (
              'Initialize Pool First'
            ) : (
              '2. Add Liquidity (SDK)'
            )}
          </button>
        </div>
      )}

      {tab === 'remove' && (
        <div className="bg-white p-6 rounded-xl shadow-lg border text-center text-gray-500">
          Remove liquidity requires position NFT tracking.
          <br/>Use the PositionManager to burn your position.
        </div>
      )}
    </div>
  );
}