import { useState, useEffect } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, keccak256, encodeAbiParameters } from 'viem'; // Add keccak256 and encodeAbiParameters
import { 
  Plus, 
  Droplets, 
  Settings, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Info,
  ExternalLink,
  Beaker,
  Copy,
  Check,
  Wallet,
  ArrowRight,
  Search
} from 'lucide-react';
import { 
  POOL_MANAGER_ADDRESS,
  TOKENS,
  HOOK_ADDRESS,
  POSITION_MANAGER_ADDRESS,
  PERMIT2_ADDRESS
} from '../contracts/constants';

// PositionManager ABI
const POSITION_MANAGER_ABI = [
  {
    inputs: [
      {
        components: [
          { name: 'poolKey', type: 'tuple', components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' }
          ]},
          { name: 'tickLower', type: 'int24' },
          { name: 'tickUpper', type: 'int24' },
          { name: 'salt', type: 'bytes32' }
        ],
        name: 'params',
        type: 'tuple'
      },
      { name: 'liquidity', type: 'uint256' }
    ],
    name: 'mint',
    outputs: [{ name: 'tokenId', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

// PoolManager ABI
const POOL_MANAGER_ABI = [
  {
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    name: 'getSlot0',
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'hookFee', type: 'uint24' },
      { name: 'liquidity', type: 'uint128' }
    ],
    stateMutability: 'view',
    type: 'function'
  },
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
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'hookData', type: 'bytes' }
    ],
    name: 'initialize',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const PERMIT2_ABI = [
  {
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' }
    ],
    name: 'approve',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  }
] as const;

const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string; decimals: number }> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    decimals: 18,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    decimals: 6,
  },
};

const FEE_TIERS = [
  { fee: 100, label: '0.01%', description: 'Stable pairs', ticks: 1 },
  { fee: 500, label: '0.05%', description: 'Blue chips', ticks: 10 },
  { fee: 3000, label: '0.3%', description: 'Most pairs', ticks: 60 },
  { fee: 10000, label: '1%', description: 'Exotic pairs', ticks: 200 },
];

// Helper to convert sqrtPriceX96 to price
const sqrtPriceX96ToPrice = (sqrtPriceX96: bigint): number => {
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96) / Number(Q96);
  return price * price;
};

// Helper to convert price to tick
const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  
  // Flow state: 'select-fee' -> 'check' -> 'initialize' -> 'range' -> 'deposit'
  const [step, setStep] = useState<'select-fee' | 'check' | 'initialize' | 'range' | 'deposit'>('select-fee');
  const [selectedFee, setSelectedFee] = useState<number | null>(null);
  const [selectedTickSpacing, setSelectedTickSpacing] = useState(10);
  const [poolExists, setPoolExists] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  
  // Price range state
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [tickLower, setTickLower] = useState<number>(0);
  const [tickUpper, setTickUpper] = useState<number>(0);
  const [fullRange, setFullRange] = useState(false);
  
  // Deposit amounts
  const [usdcAmount, setUsdcAmount] = useState('100');
  const [ethAmount, setEthAmount] = useState('0.05');
  
  // UI state
  const [showSettings, setShowSettings] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txStatus, setTxStatus] = useState<'idle' | 'checking' | 'initializing' | 'approving' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: ethBalance } = useBalance({ address });
  const { data: usdcBalance } = useBalance({
    address,
    token: TOKENS.USDC.address as `0x${string}`
  });

  // Calculate pool ID using viem
  const getPoolId = (fee: number, tickSpacing: number): `0x${string}` => {
    const poolKey = {
      currency0: TOKENS.ETH.address,
      currency1: TOKENS.USDC.address,
      fee: fee,
      tickSpacing: tickSpacing,
      hooks: HOOK_ADDRESS,
    };

    // Encode the pool key tuple: (address, address, uint24, int24, address)
    const encoded = encodeAbiParameters(
      [
        { type: 'address', name: 'currency0' },
        { type: 'address', name: 'currency1' },
        { type: 'uint24', name: 'fee' },
        { type: 'int24', name: 'tickSpacing' },
        { type: 'address', name: 'hooks' }
      ],
      [poolKey.currency0, poolKey.currency1, poolKey.fee, poolKey.tickSpacing, poolKey.hooks]
    );

    return keccak256(encoded);
  };

  // Check if pool exists
  const { data: slot0, refetch: refetchPool } = useReadContract({
    address: POOL_MANAGER_ADDRESS as `0x${string}`,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: selectedFee !== null && selectedTickSpacing !== null ? [getPoolId(selectedFee, selectedTickSpacing)] : undefined,
    query: {
      enabled: step === 'check' && selectedFee !== null,
    }
  });

  useEffect(() => {
    if (step === 'check' && slot0 !== undefined) {
      if (slot0[0] !== 0n) {
        setPoolExists(true);
        const price = sqrtPriceX96ToPrice(slot0[0]);
        setCurrentPrice(price);
        setCurrentTick(Number(slot0[1]));
        
        // Set default range around current price (+/- 10%)
        const defaultMin = (price * 0.9).toFixed(6);
        const defaultMax = (price * 1.1).toFixed(6);
        setMinPrice(defaultMin);
        setMaxPrice(defaultMax);
        updateTicks(defaultMin, defaultMax, false);
        
        setStep('range');
      } else {
        setPoolExists(false);
        setStep('initialize');
      }
      setTxStatus('idle');
    }
  }, [slot0, step]);

  useEffect(() => {
    if (isSuccess && txHash) {
      if (txStatus === 'initializing') {
        setPoolExists(true);
        setStep('range');
        refetchPool();
      } else {
        setTxStatus('success');
      }
    }
  }, [isSuccess, txHash, txStatus, refetchPool]);

  const updateTicks = (min: string, max: string, isFullRange: boolean) => {
    if (isFullRange) {
      setTickLower(-887272);
      setTickUpper(887272);
      return;
    }
    if (min) {
      const tick = priceToTick(parseFloat(min));
      setTickLower(Math.floor(tick / selectedTickSpacing) * selectedTickSpacing);
    }
    if (max) {
      const tick = priceToTick(parseFloat(max));
      setTickUpper(Math.floor(tick / selectedTickSpacing) * selectedTickSpacing);
    }
  };

  const handleSelectFee = (fee: number, tickSpacing: number) => {
    setSelectedFee(fee);
    setSelectedTickSpacing(tickSpacing);
  };

  const handleCheckPool = () => {
    if (selectedFee === null) return;
    setStep('check');
    setTxStatus('checking');
    // Force refetch with the new pool ID
    refetchPool();
  };

  const handleInitializePool = async () => {
    if (!isConnected || selectedFee === null) return;
    setTxStatus('initializing');
    setError('');

    try {
      const poolKey = {
        currency0: TOKENS.ETH.address,
        currency1: TOKENS.USDC.address,
        fee: selectedFee,
        tickSpacing: selectedTickSpacing,
        hooks: HOOK_ADDRESS,
      };

      // Starting price: 1 ETH = 2000 USDC
      // sqrt(2000) * 2^96 = 79228162514264337593543950336000000
      const startingPrice = BigInt('79228162514264337593543950336000000');

      writeContract({
        address: POOL_MANAGER_ADDRESS as `0x${string}`,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [poolKey, startingPrice, '0x'],
      }, {
        onSuccess: (hash) => {
          setTxHash(hash);
        },
        onError: (err: any) => {
          // If pool already exists, just move to range step
          if (err.message?.includes('AlreadyInitialized') || err.message?.includes('pool already exists')) {
            setPoolExists(true);
            setStep('range');
          } else {
            setError('Failed to initialize pool: ' + err.message);
            setTxStatus('error');
          }
        }
      });
    } catch (err: any) {
      setError(err.message);
      setTxStatus('error');
    }
  };

  const handleAddLiquidity = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!usdcAmount || !ethAmount || parseFloat(usdcAmount) <= 0 || parseFloat(ethAmount) <= 0) {
      setError('Please enter valid amounts');
      return;
    }

    setError('');
    setTxStatus('approving');

    try {
      writeContract({
        address: TOKENS.USDC.address as `0x${string}`,
        abi: [
          {
            inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function'
          }
        ],
        functionName: 'approve',
        args: [PERMIT2_ADDRESS, parseUnits(usdcAmount, 6)],
      }, {
        onSuccess: () => {
          writeContract({
            address: PERMIT2_ADDRESS as `0x${string}`,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              TOKENS.USDC.address,
              POSITION_MANAGER_ADDRESS,
              parseUnits(usdcAmount, 6),
              Math.floor(Date.now() / 1000) + 3600
            ],
          }, {
            onSuccess: () => {
              mintLiquidity();
            },
            onError: (err: any) => {
              setError('Permit2 approval failed: ' + err.message);
              setTxStatus('error');
            }
          });
        },
        onError: (err: any) => {
          setError('USDC approval failed: ' + err.message);
          setTxStatus('error');
        }
      });
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setTxStatus('error');
    }
  };

  const mintLiquidity = () => {
    setTxStatus('pending');
    
    const usdc = parseUnits(usdcAmount, 6);
    const eth = parseUnits(ethAmount, 18);
    const liquidity = (usdc * eth) / 10n**6n;
    
    const poolKey = {
      currency0: TOKENS.ETH.address,
      currency1: TOKENS.USDC.address,
      fee: selectedFee!,
      tickSpacing: selectedTickSpacing,
      hooks: HOOK_ADDRESS,
    };

    const mintParams = {
      poolKey,
      tickLower,
      tickUpper,
      salt: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`,
    };

    writeContract({
      address: POSITION_MANAGER_ADDRESS as `0x${string}`,
      abi: POSITION_MANAGER_ABI,
      functionName: 'mint',
      args: [mintParams, liquidity],
      value: parseUnits(ethAmount, 18),
    }, {
      onSuccess: (hash) => {
        setTxHash(hash);
      },
      onError: (err: any) => {
        setError('Mint failed: ' + err.message);
        setTxStatus('error');
      }
    });
  };

  const copyPoolInfo = () => {
    const info = `Pool: ETH/USDC
Fee: ${selectedFee ? selectedFee / 10000 : 0.05}%
Hook: ${HOOK_ADDRESS}`;
    navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2002);
  };

  const setMaxBalance = (token: 'ETH' | 'USDC') => {
    if (token === 'ETH' && ethBalance) {
      const maxAmount = parseFloat(formatUnits(ethBalance.value, 18)) - 0.01;
      if (maxAmount > 0) setEthAmount(maxAmount.toFixed(6));
    } else if (token === 'USDC' && usdcBalance) {
      setUsdcAmount(formatUnits(usdcBalance.value, 6));
    }
  };

  const handleMinPriceChange = (val: string) => {
    setMinPrice(val);
    if (!fullRange) updateTicks(val, maxPrice, fullRange);
  };

  const handleMaxPriceChange = (val: string) => {
    setMaxPrice(val);
    if (!fullRange) updateTicks(minPrice, val, fullRange);
  };

  const toggleFullRange = () => {
    const newFullRange = !fullRange;
    setFullRange(newFullRange);
    if (newFullRange) {
      setTickLower(-887272);
      setTickUpper(887272);
    } else {
      updateTicks(minPrice, maxPrice, false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 px-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Add Liquidity</h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === 'select-fee' && 'Choose a fee tier'}
              {step === 'check' && 'Checking pool status...'}
              {step === 'initialize' && 'Pool needs initialization'}
              {step === 'range' && 'Set your price range'}
              {step === 'deposit' && 'Enter deposit amounts'}
            </p>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-2xl bg-white shadow-sm border border-gray-200 text-gray-600 hover:text-gray-800 hover:shadow-md transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6 px-2">
          {['Fee', 'Pool', 'Range', 'Deposit'].map((label, idx) => {
            const stepNum = idx + 1;
            let currentStepNum = 1;
            if (step === 'select-fee') currentStepNum = 1;
            else if (step === 'check' || step === 'initialize') currentStepNum = 2;
            else if (step === 'range') currentStepNum = 3;
            else if (step === 'deposit') currentStepNum = 4;
            
            const isActive = stepNum === currentStepNum;
            const isCompleted = stepNum < currentStepNum;
            
            return (
              <div key={label} className="flex items-center">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                  isActive ? 'bg-pink-500 text-white' :
                  isCompleted ? 'bg-green-500 text-white' :
                  'bg-gray-200 text-gray-500'
                }`}>
                  {isCompleted ? <CheckCircle className="w-5 h-5" /> : stepNum}
                </div>
                <span className={`ml-2 text-sm font-medium hidden sm:block ${
                  isActive ? 'text-pink-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                }`}>
                  {label}
                </span>
                {idx < 3 && (
                  <div className={`w-6 sm:w-8 h-0.5 mx-2 ${
                    isCompleted ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Warning */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex items-start gap-3">
            <Beaker className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 text-sm mb-1">
                Experimental Feature
              </h3>
              <p className="text-amber-700 text-xs mb-2">
                This is not MEV protected! Use{' '}
                <a href="https://app.uniswap.org/positions" target="_blank" rel="noopener noreferrer" className="text-pink-600 underline font-medium">
                  Uniswap UI
                </a>{' '}
                for better experience.
              </p>
              <button onClick={copyPoolInfo} className="text-xs bg-white px-3 py-1.5 rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors flex items-center gap-1 text-amber-800">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copied!' : 'Copy Pool Info'}
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Card */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
          
          {/* STEP 1: Select Fee Tier - 2x2 Grid */}
          {step === 'select-fee' && (
            <div className="space-y-6">
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-pink-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Select Fee Tier</h3>
                <p className="text-gray-500 text-sm mb-6">
                  Choose the fee tier for your liquidity position
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {FEE_TIERS.map((tier) => (
                  <button
                    key={tier.fee}
                    onClick={() => handleSelectFee(tier.fee, tier.ticks)}
                    className={`relative p-4 rounded-2xl border-2 text-left transition-all ${
                      selectedFee === tier.fee
                        ? 'border-pink-500 bg-pink-50 shadow-md'
                        : 'border-gray-200 hover:border-pink-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`font-bold text-xl mb-1 ${selectedFee === tier.fee ? 'text-pink-700' : 'text-gray-800'}`}>
                      {tier.label}
                    </div>
                    <div className="text-xs text-gray-500 leading-tight">{tier.description}</div>
                    
                    {selectedFee === tier.fee && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-pink-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button
                onClick={handleCheckPool}
                disabled={selectedFee === null || txStatus === 'checking'}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {txStatus === 'checking' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking Pool...
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    Check Pool Status
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 2: Check/Initialize Pool */}
          {(step === 'check' || step === 'initialize') && (
            <div className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  {step === 'check' ? <Loader2 className="w-8 h-8 text-pink-500 animate-spin" /> : <Droplets className="w-8 h-8 text-pink-500" />}
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {step === 'check' ? 'Checking Pool...' : 'Pool Not Initialized'}
                </h3>
                <p className="text-gray-500 text-sm mb-2">
                  Fee Tier: <span className="font-semibold text-pink-600">{selectedFee ? FEE_TIERS.find(f => f.fee === selectedFee)?.label : ''}</span>
                </p>
                {step === 'initialize' && (
                  <p className="text-gray-500 text-sm">
                    Pool ID: {selectedFee ? getPoolId(selectedFee, selectedTickSpacing).slice(0, 10) : ''}...
                  </p>
                )}
              </div>

              {step === 'initialize' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Starting Price</p>
                    <p className="text-blue-600">The pool will be initialized at 1 ETH = 2000 USDC</p>
                  </div>

                  <button
                    onClick={handleInitializePool}
                    disabled={!isConnected || isPending}
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isPending ? (
                      <span className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Initializing...
                      </span>
                    ) : (
                      'Initialize Pool'
                    )}
                  </button>
                  
                  <button
                    onClick={() => setStep('select-fee')}
                    className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                  >
                    ← Back to Fee Selection
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Price Range */}
          {step === 'range' && (
            <div className="space-y-6">
              <div className="bg-gray-50 rounded-2xl p-4 text-center">
                <div className="text-sm text-gray-500 mb-1">Current Price</div>
                <div className="text-3xl font-bold text-gray-800">
                  {currentPrice ? currentPrice.toFixed(4) : '--'}
                </div>
                <div className="text-sm text-gray-500 mt-1">ETH per USDC</div>
                <div className="text-xs text-pink-600 mt-2 font-medium">
                  Fee: {FEE_TIERS.find(f => f.fee === selectedFee)?.label}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-700">Price Range</label>
                  <button
                    onClick={toggleFullRange}
                    className={`text-xs px-3 py-1 rounded-full transition-colors ${
                      fullRange 
                        ? 'bg-pink-100 text-pink-700' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {fullRange ? 'Full Range ✓' : 'Full Range'}
                  </button>
                </div>

                {!fullRange ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-gray-50 rounded-2xl p-4 border-2 border-transparent focus-within:border-pink-500 transition-colors">
                      <label className="text-xs text-gray-500 font-medium mb-1 block">Min Price</label>
                      <input
                        type="number"
                        value={minPrice}
                        onChange={(e) => handleMinPriceChange(e.target.value)}
                        placeholder="0.00"
                        step="0.0001"
                        className="w-full bg-transparent text-2xl font-bold text-gray-800 outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">ETH/USDC</div>
                    </div>
                    <div className="bg-gray-50 rounded-2xl p-4 border-2 border-transparent focus-within:border-pink-500 transition-colors">
                      <label className="text-xs text-gray-500 font-medium mb-1 block">Max Price</label>
                      <input
                        type="number"
                        value={maxPrice}
                        onChange={(e) => handleMaxPriceChange(e.target.value)}
                        placeholder="0.00"
                        step="0.0001"
                        className="w-full bg-transparent text-2xl font-bold text-gray-800 outline-none"
                      />
                      <div className="text-xs text-gray-400 mt-1">ETH/USDC</div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-pink-50 border-2 border-pink-200 rounded-2xl p-6 text-center">
                    <div className="text-pink-800 font-bold text-lg mb-1">Full Range Position</div>
                    <p className="text-pink-600 text-sm">
                      Your liquidity will be active across all prices. You earn fees on all trades but may face impermanent loss.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                  <span>Tick Range:</span>
                  <span className="font-mono">{tickLower.toLocaleString()} ↔ {tickUpper.toLocaleString()}</span>
                </div>
              </div>

              <button
                onClick={() => setStep('deposit')}
                disabled={!fullRange && (!minPrice || !maxPrice)}
                className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Continue to Deposit
                <ArrowRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setStep('select-fee')}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
              >
                ← Change Fee Tier
              </button>
            </div>
          )}

          {/* STEP 4: Deposit */}
          {step === 'deposit' && (
            <div className="space-y-4">
              {/* ETH Input */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">Deposit ETH</span>
                  <button 
                    onClick={() => setMaxBalance('ETH')}
                    className="text-pink-500 text-sm font-semibold hover:text-pink-600"
                  >
                    Balance: {ethBalance ? parseFloat(formatUnits(ethBalance.value, 18)).toFixed(4) : '--'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    placeholder="0"
                    step="0.001"
                    className="flex-1 min-w-0 bg-transparent text-3xl text-gray-800 placeholder-gray-300 outline-none font-light"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm">
                    <img src={TOKEN_INFO.ETH.icon} alt="ETH" className="w-7 h-7 rounded-full" />
                    <span className="text-lg">ETH</span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm mt-2 font-medium">
                  ${ethAmount ? (parseFloat(ethAmount) * 2000).toFixed(2) : '0.00'}
                </div>
              </div>

              {/* Plus Divider */}
              <div className="flex justify-center -my-2 relative z-10">
                <div className="p-2 bg-white border-2 border-gray-100 shadow-md rounded-xl">
                  <Plus className="w-5 h-5 text-gray-600" />
                </div>
              </div>

              {/* USDC Input */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">Deposit USDC</span>
                  <button 
                    onClick={() => setMaxBalance('USDC')}
                    className="text-pink-500 text-sm font-semibold hover:text-pink-600"
                  >
                    Balance: {usdcBalance ? parseFloat(formatUnits(usdcBalance.value, 6)).toFixed(2) : '--'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    value={usdcAmount}
                    onChange={(e) => setUsdcAmount(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-3xl text-gray-800 placeholder-gray-300 outline-none font-light"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm">
                    <img src={TOKEN_INFO.USDC.icon} alt="USDC" className="w-7 h-7 rounded-full" />
                    <span className="text-lg">USDC</span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm mt-2 font-medium">
                  ${usdcAmount || '0.00'}
                </div>
              </div>

              {/* Pool Summary */}
              <div className="bg-blue-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fee Tier</span>
                  <span className="font-semibold">{selectedFee ? FEE_TIERS.find(f => f.fee === selectedFee)?.label : ''}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price Range</span>
                  <span className="font-semibold">
                    {fullRange ? 'Full Range' : `${parseFloat(minPrice).toFixed(4)} - ${parseFloat(maxPrice).toFixed(4)}`}
                  </span>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('range')}
                  className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleAddLiquidity}
                  disabled={!isConnected || isPending || isConfirming}
                  className={`flex-[2] py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                    !isConnected
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : isPending || isConfirming
                      ? 'bg-gradient-to-r from-pink-400 to-rose-400 text-white cursor-wait'
                      : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-pink-500/25 hover:shadow-xl'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {!isConnected ? (
                      <><Wallet className="w-5 h-5" /> Connect</>
                    ) : isPending || isConfirming ? (
                      <><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</>
                    ) : (
                      <><Droplets className="w-5 h-5" /> Add Liquidity</>
                    )}
                  </div>
                </button>
              </div>

              {txHash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 text-pink-500 hover:text-pink-600 text-sm font-medium"
                >
                  View on Etherscan <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* Alternative */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm mb-3">Prefer the official interface?</p>
          <a
            href="https://app.uniswap.org/positions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 rounded-2xl text-gray-700 font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            Open Uniswap <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}