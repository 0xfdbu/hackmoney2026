import React, { useState, useEffect } from 'react';
import { ArrowDownUp, Settings, Info, AlertCircle } from 'lucide-react';
import { useAccount, useBalance, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { sepolia } from 'wagmi/chains';
import { PRIVY_FLOW_HOOK_ABI, PRIVY_FLOW_HOOK_ADDRESS } from '../contracts/privyFlowHookABI';
import { generateRealZKProof, encodeZKProof } from '../utils/zkProofUtils';

// Sepolia testnet token addresses
const TOKENS = {
  ETH: {
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    symbol: 'ETH',
    name: 'Ethereum',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png'
  },
  WETH: {
    address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' as `0x${string}`,
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/logo.png'
  },
  USDC: {
    address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' as `0x${string}`,
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/logo.png'
  },
  DAI: {
    address: '0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6' as `0x${string}`,
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logoURI: 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/0x6B175474E89094C44Da98b954EedeAC495271d0F/logo.png'
  }
};

// ERC20 ABI for token operations
const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

// Uniswap V4 Pool Manager ABI (simplified for swap)
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
          { name: 'zeroForOne', type: 'bool' },
          { name: 'amountSpecified', type: 'int256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' },
        ],
        name: 'params',
        type: 'tuple',
      },
      { name: 'hookData', type: 'bytes' },
    ],
    name: 'swap',
    outputs: [{ name: 'delta', type: 'int256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

// Replace with your actual Pool Manager address on Sepolia
const POOL_MANAGER_ADDRESS = '0x000000000004444c5dc75cb358380d2e3de08a90' as `0x${string}`;

export default function Swap() {
  const { address, isConnected } = useAccount();
  const [fromToken, setFromToken] = useState<keyof typeof TOKENS>('WETH');
  const [toToken, setToToken] = useState<keyof typeof TOKENS>('USDC');
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [toxicityScore, setToxicityScore] = useState(50);
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Get balances for from token
  const { data: ethBalance } = useBalance({
    address: address,
    chainId: sepolia.id,
  });

  const { data: tokenBalance } = useBalance({
    address: address,
    token: fromToken !== 'ETH' ? TOKENS[fromToken].address : undefined,
    chainId: sepolia.id,
  });

  // Get allowance for from token
  const { data: allowance } = useReadContract({
    address: fromToken !== 'ETH' ? TOKENS[fromToken].address : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && fromToken !== 'ETH' ? [address, POOL_MANAGER_ADDRESS] : undefined,
  });

  // Approve token spending
  const { writeContract: approveToken, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Execute swap
  const { writeContract: executeSwap, data: swapHash, isPending: isSwapping } = useWriteContract();
  const { isLoading: isSwapConfirming, isSuccess: isSwapSuccess } = useWaitForTransactionReceipt({
    hash: swapHash,
  });

  const currentBalance = fromToken === 'ETH' ? ethBalance : tokenBalance;

  // Check if approval is needed
  useEffect(() => {
    if (fromToken === 'ETH' || !fromAmount || !address) {
      setNeedsApproval(false);
      return;
    }

    const amount = parseUnits(fromAmount, TOKENS[fromToken].decimals);
    setNeedsApproval(allowance ? allowance < amount : true);
  }, [fromToken, fromAmount, allowance, address]);

  // Simple price calculation (in production, use actual price oracle)
  useEffect(() => {
    if (!fromAmount) {
      setToAmount('');
      return;
    }

    // Mock price calculation - replace with real oracle
    const rates: Record<string, Record<string, number>> = {
      WETH: { USDC: 2000, DAI: 2000, WETH: 1, ETH: 1 },
      USDC: { WETH: 0.0005, DAI: 1, USDC: 1, ETH: 0.0005 },
      DAI: { WETH: 0.0005, USDC: 1, DAI: 1, ETH: 0.0005 },
      ETH: { WETH: 1, USDC: 2000, DAI: 2000, ETH: 1 },
    };

    const rate = rates[fromToken]?.[toToken] || 1;
    const calculated = parseFloat(fromAmount) * rate;
    setToAmount(calculated.toFixed(TOKENS[toToken].decimals === 6 ? 2 : 4));
  }, [fromAmount, fromToken, toToken]);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const handleApprove = async () => {
    if (!address || fromToken === 'ETH') return;

    try {
      const amount = parseUnits(fromAmount, TOKENS[fromToken].decimals);
      
      await approveToken({
        address: TOKENS[fromToken].address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [POOL_MANAGER_ADDRESS, amount],
      });
    } catch (error) {
      console.error('Approval failed:', error);
      alert('Approval failed: ' + (error as Error).message);
    }
  };

const handleSwap = async () => {
  if (!isConnected || !address || !fromAmount) {
    alert('Please connect wallet and enter amount');
    return;
  }

  if (needsApproval) {
    alert('Please approve token spending first');
    return;
  }

  try {
    setIsGeneratingProof(true);
    
    const swapAmount = parseUnits(fromAmount, TOKENS[fromToken].decimals);
    
    // Calculate minimum amount out based on slippage
    const minOut = calculateMinAmountOut(toAmount, slippage);
    
    // Mock pool balances - in production, fetch these from the pool contract
    // You need to get actual pool balances for the proof to be valid!
    const poolBalance0 = BigInt('1000000000000000000000'); // 1000 ETH
    const poolBalance1 = BigInt('2000000000000'); // 2,000,000 USDC (6 decimals)
    
    // Your toxicity score as bigint
    const userSignal = BigInt(toxicityScore);
    const toxicityThreshold = BigInt(100); // From your contract logic

    console.log('Generating ZK proof...');
    
    const proof = await generateRealZKProof({
      amountIn: swapAmount,
      minAmountOut: minOut,
      userSignal: userSignal,
      poolBalance0: poolBalance0,
      poolBalance1: poolBalance1,
      toxicityThreshold: toxicityThreshold,
    });

    console.log('ZK Proof generated:', proof);

    const encodedProof = encodeZKProof(proof);
    console.log('Encoded proof length:', encodedProof.length);
    
    setIsGeneratingProof(false);

    // ... rest of swap logic remains the same
    const token0 = TOKENS[fromToken];
    const token1 = TOKENS[toToken];
    const zeroForOne = token0.address.toLowerCase() < token1.address.toLowerCase();

    const poolKey = {
      currency0: zeroForOne ? token0.address : token1.address,
      currency1: zeroForOne ? token1.address : token0.address,
      fee: 3000,
      tickSpacing: 60,
      hooks: PRIVY_FLOW_HOOK_ADDRESS,
    };

    const swapParams = {
      zeroForOne,
      amountSpecified: swapAmount,
      sqrtPriceLimitX96: 0n,
    };

    await executeSwap({
      address: POOL_MANAGER_ADDRESS,
      abi: POOL_MANAGER_ABI,
      functionName: 'swap',
      args: [poolKey, swapParams, encodedProof],
      value: fromToken === 'ETH' ? swapAmount : 0n,
    });

  } catch (error: any) {
    console.error('Swap failed:', error);
    alert('Swap failed: ' + error.message);
    setIsGeneratingProof(false);
  }
};
function calculateMinAmountOut(expectedAmount: string, slippagePercent: string): bigint {
  const expected = parseFloat(expectedAmount);
  const slippage = parseFloat(slippagePercent) / 100;
  const minOut = expected * (1 - slippage);
  return parseUnits(minOut.toFixed(6), TOKENS[toToken].decimals);
}
  const handleMaxAmount = () => {
    if (currentBalance) {
      const balance = formatUnits(currentBalance.value, currentBalance.decimals);
      // Leave some ETH for gas
      if (fromToken === 'ETH') {
        const maxAmount = Math.max(0, parseFloat(balance) - 0.01);
        setFromAmount(maxAmount.toString());
      } else {
        setFromAmount(balance);
      }
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="bg-white rounded-2xl shadow-lg p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Swap</h2>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Warning if Pool Manager not configured */}
        {POOL_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000' && (
          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">Pool Manager Not Configured</p>
              <p className="text-xs text-yellow-700 mt-1">
                Please update POOL_MANAGER_ADDRESS in Swap.tsx with your deployed Uniswap V4 Pool Manager address.
              </p>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Slippage Tolerance
              </label>
              <div className="flex gap-2">
                {['0.1', '0.5', '1.0'].map((value) => (
                  <button
                    key={value}
                    onClick={() => setSlippage(value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium ${
                      slippage === value
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {value}%
                  </button>
                ))}
                <input
                  type="text"
                  value={slippage}
                  onChange={(e) => setSlippage(e.target.value)}
                  className="w-20 px-3 py-2 border rounded-lg text-sm"
                  placeholder="Custom"
                />
              </div>
            </div>
          </div>
        )}

        {/* Privacy Score Section */}
        <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-purple-600" />
            <label className="text-sm font-medium text-purple-900">
              Privacy Toxicity Score (ZK-Protected)
            </label>
          </div>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="0"
              max="100"
              value={toxicityScore}
              onChange={(e) => setToxicityScore(parseInt(e.target.value))}
              className="flex-1 h-2 bg-purple-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-lg font-semibold text-purple-700 min-w-[3rem]">
              {toxicityScore}
            </span>
          </div>
          <p className="text-xs text-purple-600 mt-2">
            Your privacy score is proven with zero-knowledge cryptography
          </p>
        </div>

        {/* From Token */}
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            From
          </label>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <input
                type="text"
                value={fromAmount}
                onChange={(e) => setFromAmount(e.target.value)}
                placeholder="0.0"
                className="text-3xl font-semibold bg-transparent outline-none w-full"
              />
              <select
                value={fromToken}
                onChange={(e) => setFromToken(e.target.value as keyof typeof TOKENS)}
                className="px-4 py-2 bg-white rounded-lg border font-semibold cursor-pointer hover:bg-gray-50 flex items-center gap-2"
              >
                {Object.entries(TOKENS).map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
            {isConnected && currentBalance && (
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  Balance: {parseFloat(formatUnits(currentBalance.value, currentBalance.decimals)).toFixed(4)} {fromToken}
                </span>
                <button
                  onClick={handleMaxAmount}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  MAX
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Swap Button */}
        <div className="flex justify-center -my-2 relative z-10">
          <button
            onClick={handleSwapTokens}
            className="bg-white border-4 border-white rounded-xl p-2 hover:bg-gray-50 transition-colors shadow-md"
          >
            <ArrowDownUp className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* To Token */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            To (estimated)
          </label>
          <div className="bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <input
                type="text"
                value={toAmount}
                readOnly
                placeholder="0.0"
                className="text-3xl font-semibold bg-transparent outline-none w-full"
              />
              <select
                value={toToken}
                onChange={(e) => setToToken(e.target.value as keyof typeof TOKENS)}
                className="px-4 py-2 bg-white rounded-lg border font-semibold cursor-pointer hover:bg-gray-50"
              >
                {Object.entries(TOKENS).map(([key, token]) => (
                  <option key={key} value={key}>
                    {token.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Swap Info */}
        {fromAmount && toAmount && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Rate</span>
              <span className="font-medium">
                1 {fromToken} ≈ {(parseFloat(toAmount) / parseFloat(fromAmount)).toFixed(4)} {toToken}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Slippage Tolerance</span>
              <span className="font-medium">{slippage}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">ZK Verification</span>
              <span className="font-medium text-green-600">✓ Enabled</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {isConnected ? (
          <div className="space-y-3">
            {needsApproval && (
              <button
                onClick={handleApprove}
                disabled={isApproving || isApproveConfirming}
                className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving || isApproveConfirming
                  ? 'Approving...'
                  : `Approve ${fromToken}`}
              </button>
            )}
            <button
              onClick={handleSwap}
              disabled={
                !fromAmount ||
                needsApproval ||
                isGeneratingProof ||
                isSwapping ||
                isSwapConfirming ||
                POOL_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000'
              }
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingProof
                ? 'Generating ZK Proof...'
                : isSwapping
                ? 'Confirming...'
                : isSwapConfirming
                ? 'Processing...'
                : isSwapSuccess
                ? 'Swap Successful!'
                : 'Swap with ZK Privacy'}
            </button>
          </div>
        ) : (
          <button className="w-full py-4 bg-gray-200 text-gray-800 rounded-xl font-semibold">
            Connect Wallet to Swap
          </button>
        )}

        {/* ZK Privacy Notice */}
        <div className="mt-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <p className="text-xs text-purple-700 text-center">
            🔒 Your transaction is protected by zero-knowledge proofs. Your privacy score
            is verified without revealing sensitive information.
          </p>
        </div>

        {/* Contract Info */}
        <div className="mt-4 text-center space-y-1">
          <p className="text-xs text-gray-500">
            Hook: {PRIVY_FLOW_HOOK_ADDRESS.slice(0, 6)}...{PRIVY_FLOW_HOOK_ADDRESS.slice(-4)}
          </p>
          <p className="text-xs text-gray-400">
            Network: Sepolia Testnet
          </p>
        </div>
      </div>
    </div>
  );
}