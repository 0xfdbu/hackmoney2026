import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { 
  Plus, 
  Droplets, 
  Settings, 
  AlertCircle, 
  CheckCircle, 
  Loader2,
  Info,
  Waves,
  Terminal,
  ExternalLink,
  Beaker
} from 'lucide-react';
import { 
  POOL_MANAGER_ADDRESS,
  TOKENS,
  HOOK_ADDRESS,
  ROUTER_ADDRESS
} from '../contracts/constants';

// ABI for PoolManager initialize
const POOL_MANAGER_ABI = [
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
      { name: 'sqrtPriceX96', type: 'uint160' }
    ],
    name: 'initialize',
    outputs: [{ name: 'tick', type: 'int24' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [{ name: 'id', type: 'bytes32' }],
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

// ABI for ERC20 approve
const ERC20_ABI = [
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Fee tiers
const FEE_TIERS = [
  { value: 100, label: '0.01%', tickSpacing: 1 },
  { value: 500, label: '0.05%', tickSpacing: 10 },
  { value: 3000, label: '0.3%', tickSpacing: 60 },
  { value: 10000, label: '1%', tickSpacing: 200 },
];

// CLI Commands for adding liquidity
const CLI_COMMANDS = `cd contracts/
source .env

# Add Liquidity to Pool
forge script script/AddLiquidity.s.sol \\
  --rpc-url $SEPOLIA_RPC_URL \\
  --broadcast \\
  -vv

# Pool Parameters:
# • USDC: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
# • WETH: 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
# • Hook: 0x1846217Bae61BF26612BD8d9a64b970d525B4080
# • Fee: 3000 (0.3%)
# • Tick Spacing: 60`;

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'initialize' | 'addLiquidity'>('initialize');
  
  // Initialize pool state
  const [feeTier, setFeeTier] = useState(3000);
  const [initialPrice, setInitialPrice] = useState('1');
  const [isPoolInitialized, setIsPoolInitialized] = useState(false);
  
  // Add liquidity state
  const [usdcAmount, setUsdcAmount] = useState('');
  const [wethAmount, setWethAmount] = useState('');
  const [tickLower, setTickLower] = useState('-60000');
  const [tickUpper, setTickUpper] = useState('60000');
  
  // Transaction states
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [txStatus, setTxStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const { writeContract, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Check if pool exists
  const { data: slot0 } = useReadContract({
    address: POOL_MANAGER_ADDRESS as `0x${string}`,
    abi: POOL_MANAGER_ABI,
    functionName: 'getSlot0',
    args: [getPoolId()],
    query: {
      enabled: true,
    }
  });

  useEffect(() => {
    if (slot0 && slot0[0] !== 0n) {
      setIsPoolInitialized(true);
    }
  }, [slot0]);

  function getPoolId() {
    return '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;
  }

  function calculateSqrtPriceX96(price: string): bigint {
    const priceNum = parseFloat(price);
    const sqrtPrice = Math.sqrt(priceNum);
    const Q96 = 2 ** 96;
    return BigInt(Math.floor(sqrtPrice * Q96));
  }

  const handleInitializePool = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    setError('');
    setTxStatus('pending');

    try {
      const tickSpacing = FEE_TIERS.find(t => t.value === feeTier)?.tickSpacing || 60;
      const sqrtPriceX96 = calculateSqrtPriceX96(initialPrice);

      writeContract({
        address: POOL_MANAGER_ADDRESS as `0x${string}`,
        abi: POOL_MANAGER_ABI,
        functionName: 'initialize',
        args: [
          {
            currency0: TOKENS.USDC.address,
            currency1: TOKENS.WETH.address,
            fee: feeTier,
            tickSpacing: tickSpacing,
            hooks: HOOK_ADDRESS,
          },
          sqrtPriceX96,
        ],
      }, {
        onSuccess: (hash) => {
          setTxHash(hash);
          setTxStatus('success');
        },
        onError: (err) => {
          setError(err.message || 'Transaction failed');
          setTxStatus('error');
        }
      });
    } catch (err: any) {
      setError(err.message || 'Failed to initialize pool');
      setTxStatus('error');
    }
  };

  const handleApproveAndAddLiquidity = async () => {
    if (!isConnected || !address) {
      setError('Please connect your wallet');
      return;
    }

    if (!usdcAmount || !wethAmount) {
      setError('Please enter both token amounts');
      return;
    }

    setError('');
    setTxStatus('pending');
    setError('Note: Full liquidity addition requires PositionManager integration. This is a simplified UI.');
    setTxStatus('error');
  };

  const copyCommands = () => {
    navigator.clipboard.writeText(CLI_COMMANDS);
    alert('Commands copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-blue-700 text-sm font-medium mb-4">
            <Waves className="w-4 h-4" />
            <span>Pool Management</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            Manage Liquidity
          </h1>
          <p className="text-gray-600">
            Initialize pools and add liquidity to the dark pool
          </p>
        </div>

        {/* Not Fully Operational Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Beaker className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-amber-800 mb-1">
                Liquidity UI is Not Fully Operational
              </h3>
              <p className="text-amber-700 text-sm mb-3">
                The liquidity management UI is currently in beta and requires PositionManager integration. 
                For now, please use one of the alternatives below to add liquidity.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://app.uniswap.org/positions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-medium text-sm transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Use Uniswap UI
                </a>
                <a
                  href="#cli-commands"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-xl font-medium text-sm transition-colors"
                >
                  <Terminal className="w-4 h-4" />
                  Use CLI Commands
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Status Card */}
        <div className={`rounded-2xl p-4 mb-6 flex items-center gap-3 ${
          isPoolInitialized ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
        }`}>
          {isPoolInitialized ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-800 font-medium">Pool is initialized and ready for liquidity</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-yellow-600" />
              <span className="text-yellow-800 font-medium">Pool needs to be initialized first</span>
            </>
          )}
        </div>

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Current UI */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            {/* Tabs */}
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setActiveTab('initialize')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'initialize'
                    ? 'bg-pink-50 text-pink-700 border-b-2 border-pink-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Settings className="w-4 h-4" />
                Initialize Pool
              </button>
              <button
                onClick={() => setActiveTab('addLiquidity')}
                className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                  activeTab === 'addLiquidity'
                    ? 'bg-pink-50 text-pink-700 border-b-2 border-pink-500'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Plus className="w-4 h-4" />
                Add Liquidity
              </button>
            </div>

            <div className="p-6">
              {/* Initialize Pool Tab */}
              {activeTab === 'initialize' && (
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">What is pool initialization?</p>
                        <p>Initializing creates the pool with an initial price ratio. This only needs to be done once per pool configuration.</p>
                      </div>
                    </div>
                  </div>

                  {/* Fee Tier Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Fee Tier
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {FEE_TIERS.map((tier) => (
                        <button
                          key={tier.value}
                          onClick={() => setFeeTier(tier.value)}
                          className={`p-4 rounded-xl border-2 transition-all ${
                            feeTier === tier.value
                              ? 'border-pink-500 bg-pink-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="font-bold text-gray-900">{tier.label}</div>
                          <div className="text-xs text-gray-500">Tick spacing: {tier.tickSpacing}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Initial Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Initial Price (WETH per USDC)
                    </label>
                    <input
                      type="number"
                      value={initialPrice}
                      onChange={(e) => setInitialPrice(e.target.value)}
                      placeholder="1.0"
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      This sets the initial exchange rate between USDC and WETH
                    </p>
                  </div>

                  {/* Pool Configuration Summary */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Pool Configuration</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Token 0</span>
                        <span className="font-mono">{TOKENS.USDC.address.slice(0, 6)}...{TOKENS.USDC.address.slice(-4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Token 1</span>
                        <span className="font-mono">{TOKENS.WETH.address.slice(0, 6)}...{TOKENS.WETH.address.slice(-4)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Fee</span>
                        <span>{feeTier / 10000}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Hook</span>
                        <span className="font-mono">{HOOK_ADDRESS.slice(0, 6)}...{HOOK_ADDRESS.slice(-4)}</span>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleInitializePool}
                    disabled={!isConnected || isPending || isConfirming}
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPending || isConfirming ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        {isConfirming ? 'Confirming...' : 'Initializing...'}
                      </>
                    ) : (
                      <>
                        <Settings className="w-5 h-5" />
                        Initialize Pool
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Add Liquidity Tab */}
              {activeTab === 'addLiquidity' && (
                <div className="space-y-6">
                  {!isPoolInitialized && (
                    <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                      <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                        <div className="text-sm text-yellow-800">
                          <p className="font-medium">Pool not initialized</p>
                          <p>You need to initialize the pool before adding liquidity.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="text-sm text-blue-800">
                        <p className="font-medium mb-1">Note on Liquidity Addition</p>
                        <p>This UI demonstrates the liquidity addition flow. Full implementation requires integration with the Uniswap v4 PositionManager contract.</p>
                      </div>
                    </div>
                  </div>

                  {/* Token Amounts */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        USDC Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={usdcAmount}
                          onChange={(e) => setUsdcAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          USDC
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-center">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Plus className="w-5 h-5 text-gray-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        WETH Amount
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          value={wethAmount}
                          onChange={(e) => setWethAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                          WETH
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Price Range (Ticks)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Min Price</label>
                        <input
                          type="number"
                          value={tickLower}
                          onChange={(e) => setTickLower(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Max Price</label>
                        <input
                          type="number"
                          value={tickUpper}
                          onChange={(e) => setTickUpper(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-ping-200 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Full range: -887272 to 887272. Narrower ranges = higher fees but more IL risk.
                    </p>
                  </div>

                  {error && (
                    <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm">
                      {error}
                    </div>
                  )}

                  <button
                    onClick={handleApproveAndAddLiquidity}
                    disabled={!isConnected || !isPoolInitialized}
                    className="w-full py-4 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/25 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Droplets className="w-5 h-5" />
                    Add Liquidity
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - CLI Commands */}
          <div id="cli-commands" className="space-y-6">
            {/* CLI Commands Card */}
            <div className="bg-gray-900 rounded-2xl shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gray-800 border-b border-gray-700">
                <div className="flex items-center gap-3">
                  <Terminal className="w-5 h-5 text-green-400" />
                  <span className="font-semibold text-gray-100">CLI Commands</span>
                </div>
                <button
                  onClick={copyCommands}
                  className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Copy All
                </button>
              </div>
              <div className="p-6">
                <p className="text-gray-400 text-sm mb-4">
                  Run these commands from the <code className="bg-gray-800 px-2 py-1 rounded text-gray-300">contracts/</code> folder:
                </p>
                <pre className="bg-gray-950 rounded-xl p-4 overflow-x-auto text-sm font-mono text-green-400 leading-relaxed">
                  {CLI_COMMANDS}
                </pre>
              </div>
            </div>

            {/* Pool Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Pool Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Network</span>
                  <span className="font-medium text-gray-900">Sepolia Testnet</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Fee Tier</span>
                  <span className="font-medium text-gray-900">0.3% (3000)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Tick Spacing</span>
                  <span className="font-medium text-gray-900">60</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Pool Manager</span>
                  <a
                    href={`https://sepolia.etherscan.io/address/${POOL_MANAGER_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-pink-600 hover:text-pink-700"
                  >
                    {POOL_MANAGER_ADDRESS.slice(0, 6)}...{POOL_MANAGER_ADDRESS.slice(-4)}
                  </a>
                </div>
              </div>
            </div>

            {/* Alternative Options */}
            <div className="bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Alternative Options</h3>
              <div className="space-y-3">
                <a
                  href="https://app.uniswap.org/positions/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-xl bg-pink-100 flex items-center justify-center group-hover:bg-pink-200 transition-colors">
                    <ExternalLink className="w-5 h-5 text-pink-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Uniswap UI</p>
                    <p className="text-sm text-gray-500">Use the official Uniswap interface</p>
                  </div>
                </a>
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Terminal className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">Foundry Scripts</p>
                    <p className="text-sm text-gray-500">Use the CLI commands above</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Status */}
        {txHash && (
          <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <h3 className="font-bold text-gray-900 mb-4">Transaction Status</h3>
            <div className="flex items-center gap-3">
              {isConfirming ? (
                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              <span className="text-gray-700">
                {isConfirming ? 'Confirming transaction...' : 
                 isSuccess ? 'Transaction confirmed!' : 
                 'Transaction failed'}
              </span>
            </div>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1 text-pink-600 hover:text-pink-700 text-sm font-medium"
            >
              View on Etherscan
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
