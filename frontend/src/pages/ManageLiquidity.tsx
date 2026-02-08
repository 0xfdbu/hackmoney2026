import { useState, useEffect } from 'react';
import { useBalance, useReadContract } from 'wagmi';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, keccak256, encodeAbiParameters } from 'viem';
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
  Search,
  ChevronDown,
  ArrowUpDown
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

const TOKEN_LIST = [
  {
    symbol: 'ETH',
    name: 'Ethereum',
    address: '0x0000000000000000000000000000000000000000',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: TOKENS.USDC.address,
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    decimals: 6,
  },
];

const FEE_TIERS = [
  { fee: 100, label: '0.01%', description: 'Stable pairs', ticks: 1 },
  { fee: 500, label: '0.05%', description: 'Blue chips', ticks: 10 },
  { fee: 3000, label: '0.3%', description: 'Most pairs', ticks: 60 },
  { fee: 10000, label: '1%', description: 'Exotic pairs', ticks: 200 },
];

const sqrtPriceX96ToPrice = (sqrtPriceX96: bigint, token0Decimals: number, token1Decimals: number): number => {
  const Q96 = 2n ** 96n;
  const price = Number(sqrtPriceX96) / Number(Q96);
  const rawPrice = price * price;
  const decimalAdjustment = 10 ** (token0Decimals - token1Decimals);
  return rawPrice * decimalAdjustment;
};

const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  
  const [step, setStep] = useState<'select-pair' | 'check' | 'initialize' | 'range' | 'deposit'>('select-pair');
  
  const [token0, setToken0] = useState(TOKEN_LIST[0]);
  const [token1, setToken1] = useState(TOKEN_LIST[1]);
  const [selectedFee, setSelectedFee] = useState<number | null>(null);
  const [selectedTickSpacing, setSelectedTickSpacing] = useState(10);
  
  const [poolExists, setPoolExists] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [currentTick, setCurrentTick] = useState<number>(0);
  
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [tickLower, setTickLower] = useState<number>(0);
  const [tickUpper, setTickUpper] = useState<number>(0);
  const [fullRange, setFullRange] = useState(false);
  
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  
  const [showTokenSelector, setShowTokenSelector] = useState<'token0' | 'token1' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txStatus, setTxStatus] = useState<'idle' | 'checking' | 'initializing' | 'approving' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash: txHash });

  const { data: balance0 } = useBalance({ 
    address,
    token: token0.address === '0x0000000000000000000000000000000000000000' ? undefined : token0.address as `0x${string}`
  });
  
  const { data: balance1 } = useBalance({ 
    address,
    token: token1.address === '0x0000000000000000000000000000000000000000' ? undefined : token1.address as `0x${string}`
  });

  const getPoolId = (fee: number, tickSpacing: number): `0x${string}` => {
    const addr0 = token0.address.toLowerCase();
    const addr1 = token1.address.toLowerCase();
    
    let currency0 = addr0 < addr1 ? token0.address : token1.address;
    let currency1 = addr0 < addr1 ? token1.address : token0.address;

    const poolKey = {
      currency0,
      currency1,
      fee: fee,
      tickSpacing: tickSpacing,
      hooks: HOOK_ADDRESS,
    };

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

  const { 
    data: slot0, 
    refetch: refetchPool,
    isLoading: isCheckingPool,
    isError: isPoolCheckError,
  } = useReadContract({
    address: POOL_MANAGER_ADDRESS as `0x${string}`,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: selectedFee !== null ? [getPoolId(selectedFee, selectedTickSpacing)] : undefined,
    query: {
      enabled: step === 'check' && selectedFee !== null,
      retry: false,
    }
  });

  useEffect(() => {
    if (step !== 'check') return;
    
    if (isCheckingPool) return;

    if (isPoolCheckError || !slot0 || slot0[0] === 0n) {
      setPoolExists(false);
      setStep('initialize');
      setTxStatus('idle');
      return;
    }

    setPoolExists(true);
    const price = sqrtPriceX96ToPrice(slot0[0], token0.decimals, token1.decimals);
    setCurrentPrice(price);
    setCurrentTick(Number(slot0[1]));
    
    const defaultMin = (price * 0.9).toFixed(6);
    const defaultMax = (price * 1.1).toFixed(6);
    setMinPrice(defaultMin);
    setMaxPrice(defaultMax);
    updateTicks(defaultMin, defaultMax, false);
    
    setStep('range');
    setTxStatus('idle');
  }, [slot0, step, isCheckingPool, isPoolCheckError, token0.decimals, token1.decimals]);

  useEffect(() => {
    if (isSuccess && txHash) {
      if (txStatus === 'initializing') {
        setPoolExists(true);
        refetchPool().then(() => {
          setStep('range');
        });
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

  const handleSwapTokens = () => {
    const temp = token0;
    setToken0(token1);
    setToken1(temp);
    setAmount0('');
    setAmount1('');
  };

  const handleSelectToken = (token: typeof TOKEN_LIST[0], type: 'token0' | 'token1') => {
    if (type === 'token0') {
      if (token.address === token1.address) {
        setToken1(token0);
      }
      setToken0(token);
    } else {
      if (token.address === token0.address) {
        setToken0(token1);
      }
      setToken1(token);
    }
    setShowTokenSelector(null);
  };

  const handleSelectFee = (fee: number, tickSpacing: number) => {
    setSelectedFee(fee);
    setSelectedTickSpacing(tickSpacing);
  };

  const handleCheckPool = () => {
    if (selectedFee === null) return;
    setStep('check');
    setTxStatus('checking');
  };

  const handleInitializePool = async () => {
    if (!isConnected || selectedFee === null) return;
    setTxStatus('initializing');
    setError('');

    try {
      const addr0 = token0.address.toLowerCase();
      const addr1 = token1.address.toLowerCase();
      let currency0 = addr0 < addr1 ? token0.address : token1.address;
      let currency1 = addr0 < addr1 ? token1.address : token0.address;

      const poolKey = {
        currency0,
        currency1,
        fee: selectedFee,
        tickSpacing: selectedTickSpacing,
        hooks: HOOK_ADDRESS,
      };

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

    if (!amount0 || !amount1 || parseFloat(amount0) <= 0 || parseFloat(amount1) <= 0) {
      setError('Please enter valid amounts');
      return;
    }

    setError('');
    setTxStatus('approving');

    try {
      writeContract({
        address: token1.address as `0x${string}`,
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
        args: [PERMIT2_ADDRESS, parseUnits(amount1, token1.decimals)],
      }, {
        onSuccess: () => {
          writeContract({
            address: PERMIT2_ADDRESS as `0x${string}`,
            abi: PERMIT2_ABI,
            functionName: 'approve',
            args: [
              token1.address,
              POSITION_MANAGER_ADDRESS,
              parseUnits(amount1, token1.decimals),
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
          setError('Token approval failed: ' + err.message);
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
    
    const amount0Parsed = parseUnits(amount0, token0.decimals);
    const amount1Parsed = parseUnits(amount1, token1.decimals);
    const liquidity = (amount0Parsed * amount1Parsed) / BigInt(10 ** Math.min(token0.decimals, token1.decimals));
    
    const addr0 = token0.address.toLowerCase();
    const addr1 = token1.address.toLowerCase();
    let currency0 = addr0 < addr1 ? token0.address : token1.address;
    let currency1 = addr0 < addr1 ? token1.address : token0.address;

    const poolKey = {
      currency0,
      currency1,
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

    const value = token0.address === '0x0000000000000000000000000000000000000000' 
      ? amount0Parsed 
      : token1.address === '0x0000000000000000000000000000000000000000' 
        ? amount1Parsed 
        : BigInt(0);

    writeContract({
      address: POSITION_MANAGER_ADDRESS as `0x${string}`,
      abi: POSITION_MANAGER_ABI,
      functionName: 'mint',
      args: [mintParams, liquidity],
      value,
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
    const info = `Pool: ${token0.symbol}/${token1.symbol}
Fee: ${selectedFee ? selectedFee / 10000 : 0.05}%
Hook: ${HOOK_ADDRESS}`;
    navigator.clipboard.writeText(info);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const setMaxBalance = (token: 'token0' | 'token1') => {
    if (token === 'token0' && balance0) {
      const maxAmount = parseFloat(formatUnits(balance0.value, token0.decimals));
      const reserve = token0.address === '0x0000000000000000000000000000000000000000' ? 0.01 : 0;
      const finalAmount = Math.max(0, maxAmount - reserve);
      if (finalAmount > 0) setAmount0(finalAmount.toFixed(6));
    } else if (token === 'token1' && balance1) {
      setAmount1(formatUnits(balance1.value, token1.decimals));
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

  const getStepNumber = () => {
    switch (step) {
      case 'select-pair': return 1;
      case 'check': return 2;
      case 'initialize': return 2;
      case 'range': return 3;
      case 'deposit': return 4;
      default: return 1;
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
              {step === 'select-pair' && 'Select pair and fee tier'}
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
          {['Pair', 'Pool', 'Range', 'Deposit'].map((label, idx) => {
            const stepNum = idx + 1;
            const currentStepNum = getStepNumber();
            
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
          
          {/* STEP 1: Select Pair and Fee (Combined) */}
          {step === 'select-pair' && (
            <div className="space-y-6">
              {/* Token Selection - No bg-gray-50 wrapper */}
              <div className="rounded-2xl space-y-3">
                {/* Token 0 */}
                <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200">
                  <button 
                    onClick={() => setShowTokenSelector('token0')}
                    className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  >
                    <img src={token0.icon} alt={token0.symbol} className="w-8 h-8 rounded-full" />
                    <span className="font-bold text-lg">{token0.symbol}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Balance: {balance0 ? parseFloat(formatUnits(balance0.value, token0.decimals)).toFixed(4) : '--'}</div>
                  </div>
                </div>

                {/* Swap Button */}
                <div className="flex justify-center -my-2 relative z-10">
                  <button 
                    onClick={handleSwapTokens}
                    className="p-2 bg-white border-2 border-gray-100 shadow-md rounded-xl hover:bg-gray-50 transition-colors"
                  >
                    <ArrowUpDown className="w-4 h-4 text-gray-600" />
                  </button>
                </div>

                {/* Token 1 */}
                <div className="flex items-center justify-between bg-white rounded-xl p-3 border border-gray-200">
                  <button 
                    onClick={() => setShowTokenSelector('token1')}
                    className="flex items-center gap-2 hover:bg-gray-50 p-2 rounded-lg transition-colors"
                  >
                    <img src={token1.icon} alt={token1.symbol} className="w-8 h-8 rounded-full" />
                    <span className="font-bold text-lg">{token1.symbol}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Balance: {balance1 ? parseFloat(formatUnits(balance1.value, token1.decimals)).toFixed(4) : '--'}</div>
                  </div>
                </div>
              </div>

              {/* Fee Selection - Always Visible */}
              <div className="space-y-4">
                <h4 className="font-semibold text-gray-700">Select Fee Tier</h4>
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
            </div>
          )}

          {/* Token Selector Modal */}
          {showTokenSelector && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl p-6 max-w-sm w-full max-h-[80vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold">Select Token</h3>
                  <button onClick={() => setShowTokenSelector(null)} className="p-2 hover:bg-gray-100 rounded-full">
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
                <div className="space-y-2">
                  {TOKEN_LIST.map((token) => (
                    <button
                      key={token.symbol}
                      onClick={() => handleSelectToken(token, showTokenSelector)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
                    >
                      <img src={token.icon} alt={token.symbol} className="w-10 h-10 rounded-full" />
                      <div className="text-left">
                        <div className="font-bold">{token.symbol}</div>
                        <div className="text-sm text-gray-500">{token.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
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
                  {token0.symbol}/{token1.symbol} • Fee: {selectedFee ? FEE_TIERS.find(f => f.fee === selectedFee)?.label : ''}
                </p>
                {step === 'initialize' && (
                  <p className="text-gray-500 text-xs font-mono mt-2">
                    Pool ID: {selectedFee ? getPoolId(selectedFee, selectedTickSpacing).slice(0, 10) : ''}...
                  </p>
                )}
              </div>

              {step === 'initialize' && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-800">
                    <p className="font-semibold mb-1">Starting Price</p>
                    <p className="text-blue-600">The pool will be initialized at 1 {token0.symbol} = 2000 {token1.symbol}</p>
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
                    onClick={() => setStep('select-pair')}
                    className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
                  >
                    ← Back to Pair Selection
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
                <div className="text-sm text-gray-500 mt-1">{token1.symbol} per {token0.symbol}</div>
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
                      <div className="text-xs text-gray-400 mt-1">{token1.symbol}/{token0.symbol}</div>
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
                      <div className="text-xs text-gray-400 mt-1">{token1.symbol}/{token0.symbol}</div>
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
                onClick={() => setStep('select-pair')}
                className="w-full py-3 text-gray-500 font-medium hover:text-gray-700 transition-colors"
              >
                ← Change Pair or Fee
              </button>
            </div>
          )}

          {/* STEP 4: Deposit */}
          {step === 'deposit' && (
            <div className="space-y-4">
              {/* Token 0 Input */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">Deposit {token0.symbol}</span>
                  <button 
                    onClick={() => setMaxBalance('token0')}
                    className="text-pink-500 text-sm font-semibold hover:text-pink-600"
                  >
                    Balance: {balance0 ? parseFloat(formatUnits(balance0.value, token0.decimals)).toFixed(4) : '--'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    value={amount0}
                    onChange={(e) => setAmount0(e.target.value)}
                    placeholder="0"
                    step="0.001"
                    className="flex-1 min-w-0 bg-transparent text-3xl text-gray-800 placeholder-gray-300 outline-none font-light"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm">
                    <img src={token0.icon} alt={token0.symbol} className="w-7 h-7 rounded-full" />
                    <span className="text-lg">{token0.symbol}</span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm mt-2 font-medium">
                  ${amount0 ? (parseFloat(amount0) * (token0.symbol === 'ETH' ? 2000 : 1)).toFixed(2) : '0.00'}
                </div>
              </div>

              {/* Plus Divider */}
              <div className="flex justify-center -my-2 relative z-10">
                <div className="p-2 bg-white border-2 border-gray-100 shadow-md rounded-xl">
                  <Plus className="w-5 h-5 text-gray-600" />
                </div>
              </div>

              {/* Token 1 Input */}
              <div className="bg-gray-50 rounded-2xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-500 text-sm font-medium">Deposit {token1.symbol}</span>
                  <button 
                    onClick={() => setMaxBalance('token1')}
                    className="text-pink-500 text-sm font-semibold hover:text-pink-600"
                  >
                    Balance: {balance1 ? parseFloat(formatUnits(balance1.value, token1.decimals)).toFixed(4) : '--'}
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="number"
                    value={amount1}
                    onChange={(e) => setAmount1(e.target.value)}
                    placeholder="0"
                    className="flex-1 min-w-0 bg-transparent text-3xl text-gray-800 placeholder-gray-300 outline-none font-light"
                  />
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm">
                    <img src={token1.icon} alt={token1.symbol} className="w-7 h-7 rounded-full" />
                    <span className="text-lg">{token1.symbol}</span>
                  </div>
                </div>
                <div className="text-gray-400 text-sm mt-2 font-medium">
                  ${amount1 || '0.00'}
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