import React, { useState } from 'react';
import { Plus, Minus, Loader2, AlertCircle } from 'lucide-react';
import { useAccount, useBalance, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { POOL_MANAGER_ABI, ERC20_ABI } from '../contracts/abis';
import { POOL_MANAGER_ADDRESS, HOOK_ADDRESS, TOKENS, TICK_SPACINGS } from '../contracts/constants';

type TokenKey = keyof typeof TOKENS;

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [tab, setTab] = useState<'add' | 'remove'>('add');
  const [t0, setT0] = useState<TokenKey>('ETH');
  const [t1, setT1] = useState<TokenKey>('USDC');
  const [fee, setFee] = useState(3000);
  const [amt0, setAmt0] = useState('');
  const [amt1, setAmt1] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  const { writeContract: modify, isPending: isModifying } = useWriteContract();
  const { writeContract: init, isPending: isInit } = useWriteContract();
  const { writeContract: approve, isPending: isApproving } = useWriteContract();

  const bal0 = useBalance({ address, token: TOKENS[t0].isNative ? undefined : TOKENS[t0].address });
  const bal1 = useBalance({ address, token: TOKENS[t1].isNative ? undefined : TOKENS[t1].address });

  // Get pool key with proper ordering (currency0 < currency1)
  const getPoolKey = () => {
    const addr0 = TOKENS[t0].address.toLowerCase();
    const addr1 = TOKENS[t1].address.toLowerCase();
    
    // ETH (0x0000...) should be currency0, USDC (0x1c7D...) currency1
    if (addr0 < addr1) {
      return {
        currency0: TOKENS[t0].address,
        currency1: TOKENS[t1].address,
        fee,
        tickSpacing: TICK_SPACINGS[fee],
        hooks: HOOK_ADDRESS,
      };
    } else {
      return {
        currency0: TOKENS[t1].address,
        currency1: TOKENS[t0].address,
        fee,
        tickSpacing: TICK_SPACINGS[fee],
        hooks: HOOK_ADDRESS,
      };
    }
  };

  const handleInit = async () => {
    if (!isConnected) return;
    try {
      setError('');
      setLoading('init');
      
      const key = getPoolKey();
      
      // Check if already initialized
      try {
        const slot0 = await publicClient?.readContract({
          address: POOL_MANAGER_ADDRESS,
          abi: POOL_MANAGER_ABI,
          functionName: 'getSlot0',
          args: [key],
        });
        if (slot0 && slot0[0] !== 0n) {
          setError('Pool already initialized!');
          setLoading('');
          return;
        }
      } catch (e) {
        // Pool doesn't exist, continue
      }
      
      // Match Foundry script exactly: 2^96 for 1:1 price
      const sqrtPriceX96 = 79228162514264337593543950336n;

      console.log('Initializing:', key);

      await init({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [key, sqrtPriceX96], // Only 2 args!
      });
      
      setLoading('');
    } catch (e: any) {
      console.error('Init error:', e);
      setError(e.shortMessage || e.message || 'Failed');
      setLoading('');
    }
  };

  const handleAdd = async () => {
    if (!isConnected || !amt0 || !amt1) return;
    setLoading('check');
    setError('');
    
    try {
      const key = getPoolKey();
      
      // Check pool exists
      let slot0;
      try {
        slot0 = await publicClient?.readContract({
          address: POOL_MANAGER_ADDRESS,
          abi: POOL_MANAGER_ABI,
          functionName: 'getSlot0',
          args: [key],
        });
      } catch (e) {
        slot0 = null;
      }
      
      if (!slot0 || slot0[0] === 0n) {
        setError('Pool not initialized. Click Initialize first.');
        setLoading('');
        return;
      }

      // Determine which token is currency0/currency1
      const isT0Currency0 = key.currency0 === TOKENS[t0].address;
      const tok0 = isT0Currency0 ? TOKENS[t0] : TOKENS[t1];
      const tok1 = isT0Currency0 ? TOKENS[t1] : TOKENS[t0];
      const a0 = parseUnits(amt0, tok0.decimals);
      const a1 = parseUnits(amt1, tok1.decimals);

      // Approve tokens if needed
      if (!tok0.isNative) {
        const allow = await publicClient?.readContract({ 
          address: tok0.address, 
          abi: ERC20_ABI, 
          functionName: 'allowance', 
          args: [address!, POOL_MANAGER_ADDRESS] 
        });
        if (!allow || allow < a0) {
          setLoading('approve0');
          await approve({ 
            address: tok0.address, 
            abi: ERC20_ABI, 
            functionName: 'approve', 
            args: [POOL_MANAGER_ADDRESS, a0 * 100n] 
          });
          return;
        }
      }
      
      if (!tok1.isNative) {
        const allow = await publicClient?.readContract({ 
          address: tok1.address, 
          abi: ERC20_ABI, 
          functionName: 'allowance', 
          args: [address!, POOL_MANAGER_ADDRESS] 
        });
        if (!allow || allow < a1) {
          setLoading('approve1');
          await approve({ 
            address: tok1.address, 
            abi: ERC20_ABI, 
            functionName: 'approve', 
            args: [POOL_MANAGER_ADDRESS, a1 * 100n] 
          });
          return;
        }
      }

      setLoading('add');
      
      // Calculate liquidity (simplified)
      const liquidity = BigInt(Math.floor(Math.sqrt(Number(a0) * Number(a1))));
      
      await modify({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'modifyLiquidity',
        args: [
          key, 
          { 
            tickLower: -60, 
            tickUpper: 60, 
            liquidityDelta: liquidity, 
            salt: `0x${'0'.repeat(64)}` 
          }, 
          '0x'
        ],
        value: tok0.isNative ? a0 : tok1.isNative ? a1 : 0n,
      });
      
      setLoading('');
    } catch (e: any) {
      setError(e.shortMessage || e.message || 'Failed');
      setLoading('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Manage Liquidity</h1>
      
      <button 
        onClick={handleInit} 
        disabled={isInit}
        className="mb-4 w-full py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg text-sm font-medium disabled:opacity-50"
      >
        {isInit ? <><Loader2 className="w-4 h-4 inline animate-spin mr-1"/> Initializing...</> : `1. Initialize Pool (${fee/10000}% fee)`}
      </button>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      )}

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab('add')} className={`flex-1 py-2 rounded-lg font-medium ${tab==='add'?'bg-blue-600 text-white':'bg-gray-100'}`}><Plus className="w-4 h-4 inline mr-1"/> Add</button>
        <button onClick={() => setTab('remove')} className={`flex-1 py-2 rounded-lg font-medium ${tab==='remove'?'bg-red-600 text-white':'bg-gray-100'}`}><Minus className="w-4 h-4 inline mr-1"/> Remove</button>
      </div>

      {tab === 'add' ? (
        <div className="space-y-4 bg-white p-6 rounded-xl shadow">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Token 1</label>
              <select value={t0} onChange={(e) => setT0(e.target.value as TokenKey)} className="w-full p-2 border rounded mt-1">
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Bal: {bal0.data ? formatUnits(bal0.data.value, bal0.data.decimals) : '0'}</p>
            </div>
            <div>
              <label className="text-sm font-medium">Token 2</label>
              <select value={t1} onChange={(e) => setT1(e.target.value as TokenKey)} className="w-full p-2 border rounded mt-1">
                {Object.keys(TOKENS).map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1">Bal: {bal1.data ? formatUnits(bal1.data.value, bal1.data.decimals) : '0'}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Fee Tier</label>
            <div className="flex gap-2 mt-1">
              {[100, 500, 3000, 10000].map(f => (
                <button key={f} onClick={() => setFee(f)} className={`flex-1 py-2 rounded border text-sm ${fee===f?'bg-blue-50 border-blue-500':'bg-white'}`}>
                  {f/10000}%
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <input type="number" value={amt0} onChange={(e) => setAmt0(e.target.value)} placeholder={`${t0} amount`} className="w-full p-3 border rounded text-lg" />
            <input type="number" value={amt1} onChange={(e) => setAmt1(e.target.value)} placeholder={`${t1} amount`} className="w-full p-3 border rounded text-lg" />
          </div>

          <button 
            onClick={handleAdd} 
            disabled={isModifying || isApproving || !!loading}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading === 'check' ? <><Loader2 className="w-4 h-4 animate-spin"/> Checking...</> :
             loading === 'approve0' || loading === 'approve1' ? <><Loader2 className="w-4 h-4 animate-spin"/> Approving...</> :
             isModifying ? <><Loader2 className="w-4 h-4 animate-spin"/> Adding...</> :
             '2. Add Liquidity'}
          </button>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <p>Position management coming soon</p>
          <p className="text-sm mt-2">Requires ERC6909 position tokens</p>
        </div>
      )}
    </div>
  );
}