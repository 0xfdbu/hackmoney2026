import React, { useState, useEffect } from 'react';
import { Plus, Minus, Info, TrendingUp, AlertCircle, Wallet, ChevronDown } from 'lucide-react';
import { 
  useAccount, 
  useBalance, 
  useWriteContract, 
  useWaitForTransactionReceipt, 
  useReadContract,
  usePublicClient 
} from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { sepolia } from 'wagmi/chains';

// ABI for Uniswap V4 PoolManager modifyLiquidity
const POOL_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
        name: 'key',
        type: 'tuple',
      },
      {
        components: [
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'liquidityDelta', type: 'int128' },
          { name: 'salt', type: 'bytes32' },
        ],
        name: 'params',
        type: 'tuple',
      },
      { name: 'hookData', type: 'bytes' },
    ],
    name: 'modifyLiquidity',
    outputs: [
      { name: 'callerDelta', type: 'int256' },
      { name: 'feesAccrued', type: 'int256' }
    ],
    stateMutability: 'payable',
    type: 'function',
  },
] as const;

// ERC20 ABI for approvals
const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// WETH ABI for deposit/withdraw
const WETH_ABI = [
  {
    inputs: [],
    name: 'deposit',
    outputs: [],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'wad', type: 'uint256' }],
    name: 'withdraw',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

const TOKENS = {
  ETH: { 
    address: '0x0000000000000000000000000000000000000000' as Address, 
    decimals: 18, 
    symbol: 'ETH',
    isNative: true 
  },
  WETH: { 
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as Address, 
    decimals: 18, 
    symbol: 'WETH',
    isNative: false 
  },
  USDC: { 
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as Address, 
    decimals: 6, 
    symbol: 'USDC',
    isNative: false 
  },
  DAI: { 
    address: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6' as Address, 
    decimals: 18, 
    symbol: 'DAI',
    isNative: false 
  },
};

const POOL_MANAGER_ADDRESS = '0xE03A1074c86CFeDd5C142C4F04F1a1536e203543' as Address;
const HOOK_ADDRESS = '0x80155F48AeADFB2cf5B27577c48A61e04F66BFde' as Address;
const WETH_ADDRESS = TOKENS.WETH.address;

// Tick spacing mapping
const TICK_SPACINGS: Record<number, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
};

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [activeTab, setActiveTab] = useState<'add' | 'remove'>('add');
  const [token0, setToken0] = useState<keyof typeof TOKENS>('WETH');
  const [token1, setToken1] = useState<keyof typeof TOKENS>('USDC');
  const [fee, setFee] = useState(3000);
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [tickLower, setTickLower] = useState(-60);
  const [tickUpper, setTickUpper] = useState(60);
  const [isFullRange, setIsFullRange] = useState(false);
  const [slippage, setSlippage] = useState(0.5);
  const [isLoadingPrice, setIsLoadingPrice] = useState(false);

  // Balances
  const { data: balance0 } = useBalance({
    address,
    token: TOKENS[token0].isNative ? undefined : TOKENS[token0].address,
    chainId: sepolia.id,
  });

  const { data: balance1 } = useBalance({
    address,
    token: TOKENS[token1].isNative ? undefined : TOKENS[token1].address,
    chainId: sepolia.id,
  });

  // Contracts
  const { writeContract: modifyLiquidity, data: addHash, isPending: isAdding } = useWriteContract();
  const { writeContract: approveToken, isPending: isApproving } = useWriteContract();
  const { writeContract: wrapEth } = useWriteContract();
  
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ 
    hash: addHash 
  });

  // Auto-calculate amount1 based on amount0 and price
  useEffect(() => {
    if (!amount0 || isFullRange) return;
    
    const calculateAmount1 = async () => {
      setIsLoadingPrice(true);
      try {
        // Mock price calculation - in production, fetch from pool contract
        // sqrtPriceX96 -> price calculation
        const rate = token0 === 'WETH' || token0 === 'ETH' ? 2000 : 0.0005;
        const calculated = parseFloat(amount0) * rate * (1 + (tickUpper - tickLower) / 10000);
        setAmount1(calculated.toFixed(TOKENS[token1].decimals === 6 ? 2 : 4));
      } catch (error) {
        console.error('Price calculation failed:', error);
      } finally {
        setIsLoadingPrice(false);
      }
    };

    const timeout = setTimeout(calculateAmount1, 500);
    return () => clearTimeout(timeout);
  }, [amount0, token0, token1, tickLower, tickUpper, isFullRange]);

  // Ensure correct token ordering (currency0 < currency1)
  const getOrderedTokens = () => {
    const addr0 = TOKENS[token0].address.toLowerCase();
    const addr1 = TOKENS[token1].address.toLowerCase();
    
    if (addr0 < addr1) {
      return {
        currency0: TOKENS[token0],
        currency1: TOKENS[token1],
        amount0: amount0,
        amount1: amount1,
        originalOrder: true
      };
    } else {
      return {
        currency0: TOKENS[token1],
        currency1: TOKENS[token0],
        amount0: amount1,
        amount1: amount0,
        originalOrder: false
      };
    }
  };

  const handleFullRangeToggle = () => {
    const newFullRange = !isFullRange;
    setIsFullRange(newFullRange);
    
    if (newFullRange) {
      // Max ticks for 60 spacing (tickSpacing must match fee tier)
      const spacing = TICK_SPACINGS[fee] || 60;
      setTickLower(-887272 / spacing * spacing);
      setTickUpper(887272 / spacing * spacing);
    } else {
      setTickLower(-60);
      setTickUpper(60);
    }
  };

  const handleFeeChange = (newFee: number) => {
    setFee(newFee);
    const spacing = TICK_SPACINGS[newFee] || 60;
    if (isFullRange) {
      setTickLower(-887272 / spacing * spacing);
      setTickUpper(887272 / spacing * spacing);
    } else {
      // Reset to reasonable range for new spacing
      setTickLower(-spacing);
      setTickUpper(spacing);
    }
  };

  const checkAndApproveTokens = async () => {
    const ordered = getOrderedTokens();
    
    // Check token0 approval if not ETH
    if (!ordered.currency0.isNative) {
      const allowance = await publicClient?.readContract({
        address: ordered.currency0.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, POOL_MANAGER_ADDRESS],
      });

      const amount = parseUnits(ordered.amount0 || '0', ordered.currency0.decimals);
      
      if (!allowance || allowance < amount) {
        await approveToken({
          address: ordered.currency0.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POOL_MANAGER_ADDRESS, parseUnits('1000000', ordered.currency0.decimals)],
        });
        return false;
      }
    }

    // Check token1 approval if not ETH
    if (!ordered.currency1.isNative) {
      const allowance = await publicClient?.readContract({
        address: ordered.currency1.address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address!, POOL_MANAGER_ADDRESS],
      });

      const amount = parseUnits(ordered.amount1 || '0', ordered.currency1.decimals);
      
      if (!allowance || allowance < amount) {
        await approveToken({
          address: ordered.currency1.address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [POOL_MANAGER_ADDRESS, parseUnits('1000000', ordered.currency1.decimals)],
        });
        return false;
      }
    }

    return true;
  };

  const handleAddLiquidity = async () => {
    if (!isConnected || !address) {
      alert('Please connect wallet');
      return;
    }

    if (!amount0 || !amount1) {
      alert('Please enter amounts for both tokens');
      return;
    }

    try {
      // Check approvals first
      const ready = await checkAndApproveTokens();
      if (!ready) return;

      const ordered = getOrderedTokens();
      const amount0Wei = parseUnits(ordered.amount0, ordered.currency0.decimals);
      const amount1Wei = parseUnits(ordered.amount1, ordered.currency1.decimals);

      // Calculate liquidity delta (simplified sqrt approximation)
      // In production, use precise liquidity math: L = sqrt(amount0 * amount1)
      const liquidityDelta = BigInt(Math.floor(
        Math.sqrt(Number(amount0Wei) * Number(amount1Wei))
      ));

      const poolKey = {
        currency0: ordered.currency0.address,
        currency1: ordered.currency1.address,
        fee: fee,
        tickSpacing: TICK_SPACINGS[fee] || 60,
        hooks: HOOK_ADDRESS,
      };

      const params = {
        tickLower: tickLower,
        tickUpper: tickUpper,
        liquidityDelta: liquidityDelta,
        salt: `0x${'0'.repeat(64)}` as `0x${string}`,
      };

      // Calculate ETH value to send
      let ethValue = 0n;
      if (ordered.currency0.isNative) ethValue += amount0Wei;
      if (ordered.currency1.isNative) ethValue += amount1Wei;

      console.log('Adding liquidity:', {
        poolKey,
        params,
        ethValue: ethValue.toString(),
        liquidityDelta: liquidityDelta.toString()
      });

      await modifyLiquidity({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'modifyLiquidity',
        args: [poolKey, params, '0x'],
        value: ethValue,
      });

    } catch (error: any) {
      console.error('Add liquidity failed:', error);
      alert('Failed to add liquidity: ' + (error?.message || 'Unknown error'));
    }
  };

  const handleRemoveLiquidity = async () => {
    alert('Remove liquidity requires ERC6909 position tokens. Implement based on your PositionManager contract.');
  };

  // Mock positions data (in production, fetch from subgraph or contract)
  const positions = [
    {
      id: 1,
      token0: 'WETH',
      token1: 'USDC',
      fee: 0.3,
      liquidity: '1.5M',
      tickLower: -60,
      tickUpper: 60,
      value: '$2,450',
      fees: '$12.50',
    }
  ];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Manage Liquidity</h1>
        <p className="text-gray-600">Add or remove liquidity from Uniswap V4 pools</p>
      </div>
      
      {/* Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('add')}
          className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'add' 
              ? 'bg-blue-600 text-white shadow-lg' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Plus className="w-5 h-5" /> Add Liquidity
        </button>
        <button
          onClick={() => setActiveTab('remove')}
          className={`flex-1 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
            activeTab === 'remove' 
              ? 'bg-red-600 text-white shadow-lg' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Minus className="w-5 h-5" /> Remove Liquidity
        </button>
      </div>

      {activeTab === 'add' ? (
        <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
          {/* Token Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Token 1</label>
              <select 
                value={token0}
                onChange={(e) => setToken0(e.target.value as keyof typeof TOKENS)}
                className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TOKENS).map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol} {token.isNative ? '(Native)' : ''}
                  </option>
                ))}
              </select>
              {balance0 && (
                <p className="text-xs text-gray-500 text-right">
                  Balance: {parseFloat(formatUnits(balance0.value, balance0.decimals)).toFixed(4)} {token0}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Token 2</label>
              <select 
                value={token1}
                onChange={(e) => setToken1(e.target.value as keyof typeof TOKENS)}
                className="w-full p-3 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(TOKENS).map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol} {token.isNative ? '(Native)' : ''}
                  </option>
                ))}
              </select>
              {balance1 && (
                <p className="text-xs text-gray-500 text-right">
                  Balance: {parseFloat(formatUnits(balance1.value, balance1.decimals)).toFixed(4)} {token1}
                </p>
              )}
            </div>
          </div>

          {/* Fee Tier Selection */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Fee Tier</label>
            <div className="grid grid-cols-4 gap-2">
              {[100, 500, 3000, 10000].map((f) => (
                <button
                  key={f}
                  onClick={() => handleFeeChange(f)}
                  className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                    fee === f 
                      ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' 
                      : 'bg-white hover:bg-gray-50'
                  }`}
                >
                  {f / 10000}%
                  <span className="block text-xs font-normal text-gray-500">
                    {f === 100 ? '1 bps' : f === 500 ? '5 bps' : f === 3000 ? '30 bps' : '100 bps'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Price Range Selection */}
          <div className="p-4 bg-gray-50 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Price Range</label>
              <button
                onClick={handleFullRangeToggle}
                className={`text-sm px-4 py-1.5 rounded-full font-medium transition-all ${
                  isFullRange 
                    ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                    : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {isFullRange ? 'Full Range ✓' : 'Full Range'}
              </button>
            </div>
            
            {!isFullRange ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Min Tick</label>
                  <input 
                    type="number"
                    value={tickLower}
                    onChange={(e) => setTickLower(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                    step={TICK_SPACINGS[fee]}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Max Tick</label>
                  <input 
                    type="number"
                    value={tickUpper}
                    onChange={(e) => setTickUpper(Number(e.target.value))}
                    className="w-full p-2 border rounded-lg"
                    step={TICK_SPACINGS[fee]}
                  />
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border">
                <p className="font-medium mb-1">Providing liquidity across full price range</p>
                <p className="text-xs">Your liquidity will be active at all prices. Best for exotic pairs or maximum simplicity, but lower capital efficiency.</p>
              </div>
            )}
          </div>

          {/* Deposit Amounts */}
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {token0} Amount
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={amount0}
                  onChange={(e) => setAmount0(e.target.value)}
                  placeholder="0.0"
                  className="w-full p-4 text-2xl border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <button 
                  onClick={() => balance0 && setAmount0(formatUnits(balance0.value, balance0.decimals))}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  MAX
                </button>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="bg-gray-100 p-2 rounded-full">
                <Plus className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                {token1} Amount {isLoadingPrice && <span className="text-xs text-gray-400">(calculating...)</span>}
              </label>
              <input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                placeholder="0.0"
                className="w-full p-4 text-2xl border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                readOnly={!isFullRange}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100 space-y-2">
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">Hook-Enabled Pool</p>
                <p className="text-xs">
                  This pool uses the PrivyFlow hook for ZK-protected swaps. 
                  Liquidity provision is not affected by ZK verification, but swaps will require valid proofs.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleAddLiquidity}
            disabled={isAdding || isConfirming || !amount0 || !amount1 || isApproving}
            className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isApproving ? 'Approving Tokens...' : 
             isAdding || isConfirming ? 'Adding Liquidity...' : 
             'Add Liquidity'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {positions.length > 0 ? (
            positions.map((pos) => (
              <div key={pos.id} className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold">
                      {pos.token0}/{pos.token1}
                    </h3>
                    <p className="text-sm text-gray-500">{pos.fee}% Fee Tier</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{pos.value}</p>
                    <p className="text-sm text-green-600">+{pos.fees} fees</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-500">Liquidity</p>
                    <p className="font-semibold">{pos.liquidity}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-500">Range</p>
                    <p className="font-semibold">{pos.tickLower} to {pos.tickUpper}</p>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-gray-500">Status</p>
                    <p className="font-semibold text-green-600">In Range</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors">
                    Collect Fees
                  </button>
                  <button 
                    onClick={handleRemoveLiquidity}
                    className="flex-1 py-3 bg-red-50 text-red-600 rounded-lg font-semibold hover:bg-red-100 transition-colors"
                  >
                    Remove Liquidity
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Positions Found</h3>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                You don't have any liquidity positions yet. Add liquidity to start earning fees on trades.
              </p>
              <button 
                onClick={() => setActiveTab('add')}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Add Your First Liquidity
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}