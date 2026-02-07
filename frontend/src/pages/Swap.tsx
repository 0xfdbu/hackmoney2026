import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters, keccak256, encodePacked } from 'viem';
import { ROUTER_ABI } from '../contracts/routerABI';
import { COMMIT_STORE_ABI } from '../contracts/commitStoreABI';
import { 
  HOOK_ADDRESS, 
  COMMIT_STORE_ADDRESS,
  TOKENS,
  BATCH_DURATION,
  ROUTER_ADDRESS,
  MIN_SQRT_PRICE,
  MAX_SQRT_PRICE
} from '../contracts/constants';
import { Settings, ArrowDown, Info, X, CheckCircle, Clock, Loader2 } from 'lucide-react';
import TokenSelector from '../components/TokenSelector';

const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string; isWeth?: boolean }> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  },
  WETH: {
    symbol: 'ETH',  // Display as ETH
    name: 'Ethereum',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    isWeth: true,   // But it's actually WETH under the hood
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
};

interface TransactionModal {
  isOpen: boolean;
  type: 'commit' | 'reveal' | 'approve' | null;
  status: 'pending' | 'success' | 'error';
  hash?: string;
  error?: string;
}

interface CommitmentInfo {
  commitment: `0x${string}`;
  nullifier: `0x${string}`;
  salt: bigint;
  amount: bigint;
  minOut: bigint;
  fromToken: 'ETH' | 'USDC' | 'WETH';
  toToken: 'ETH' | 'USDC' | 'WETH';
}

// Helper component to verify salt
function SaltDisplay({ commitmentData, manualSalt, onToggleInput, showInput }: { 
  commitmentData: CommitmentInfo; 
  manualSalt: string; 
  onToggleInput: () => void;
  showInput: boolean;
}) {
  const verifySalt = (salt: string): { valid: boolean; color: string; message: string } => {
    if (!salt) return { valid: false, color: 'pink', message: 'No manual salt entered' };
    try {
      const test = keccak256(encodePacked(['uint256', 'uint256', 'uint256'], [commitmentData.amount, commitmentData.minOut, BigInt(salt)]));
      if (test.toLowerCase() === commitmentData.commitment.toLowerCase()) {
        return { valid: true, color: 'green', message: '✓ Salt verified - will be used for reveal' };
      }
      return { valid: false, color: 'red', message: '✗ Salt does not match commitment!' };
    } catch {
      return { valid: false, color: 'red', message: 'Invalid salt format' };
    }
  };

  const verification = manualSalt && manualSalt.trim() !== '' ? verifySalt(manualSalt) : null;
  // ALWAYS show the commitmentData salt, not manualSalt (manualSalt is only for input)
  const correctSalt = commitmentData.salt.toString();
  const displaySalt = manualSalt && manualSalt.trim() !== '' ? manualSalt : correctSalt;
  const bgColor = verification?.color === 'green' ? 'bg-green-50 border-green-200' : 
                  verification?.color === 'red' ? 'bg-red-50 border-red-200' : 
                  'bg-pink-50 border-pink-100';
  const textColor = verification?.color === 'green' ? 'text-green-600' : 
                    verification?.color === 'red' ? 'text-red-600' : 
                    'text-pink-600';

  return (
    <div className={`rounded-2xl p-4 border-2 mb-4 ${bgColor}`}>
      <div className="flex justify-between items-center mb-3">
        <span className={`text-sm font-bold uppercase tracking-wider ${textColor}`}>
          🔐 Your Secret Salt (SAVE THIS!)
        </span>
        <button onClick={onToggleInput} className="text-xs text-pink-500 hover:text-pink-700 underline">
          {showInput ? 'Hide Input' : 'Fix Salt'}
        </button>
      </div>
      <div className="bg-white rounded-xl p-3 border border-gray-200 mb-3">
        <div className="flex items-center justify-between gap-2">
          <code className="text-gray-800 font-mono text-lg font-bold truncate flex-1">{displaySalt}</code>
          <button 
            onClick={() => {
              // Copy the CORRECT salt from commitmentData, not the display value
              const saltToCopy = commitmentData.salt.toString();
              navigator.clipboard.writeText(saltToCopy);
              console.log('Copied salt to clipboard:', saltToCopy);
              alert('Correct salt copied! Save it somewhere safe.');
            }}
            className="px-4 py-2 bg-pink-500 hover:bg-pink-600 text-white rounded-lg text-sm font-semibold shadow-sm transition-colors"
          >
            Copy Correct Salt
          </button>
        </div>
      </div>
      <div className={`text-sm font-medium ${textColor}`}>
        {verification?.message || (
          <>
            ⚠️ <strong>CRITICAL:</strong> Save this salt! You need it to reveal your swap.
            <br />
            <span className="text-xs">If you lose it, your funds will be locked forever.</span>
          </>
        )}
      </div>
    </div>
  );
}

// ABI for ERC20 approve
const ERC20_ABI = [
  {
    "constant": false,
    "inputs": [
      { "name": "spender", "type": "address" },
      { "name": "amount", "type": "uint256" }
    ],
    "name": "approve",
    "outputs": [{ "name": "", "type": "bool" }],
    "type": "function"
  },
  {
    "constant": true,
    "inputs": [
      { "name": "owner", "type": "address" },
      { "name": "spender", "type": "address" }
    ],
    "name": "allowance",
    "outputs": [{ "name": "", "type": "uint256" }],
    "type": "function"
  }
] as const;

export default function Swap() {
  const { address, isConnected } = useAccount();
  
  // Default to WETH -> USDC since that direction works better with current pool price
  const [fromToken, setFromToken] = useState<'ETH' | 'USDC' | 'WETH'>('ETH');
  const [toToken, setToToken] = useState<'ETH' | 'USDC' | 'WETH'>('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('100'); // Default 100% slippage for testing
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  
  // Helper to display token symbol (WETH shows as ETH)
  const getDisplaySymbol = (token: string) => token === 'WETH' ? 'ETH' : token;
  
  // Salt recovery input
  const [manualSalt, setManualSalt] = useState('');
  const [showSaltInput, setShowSaltInput] = useState(false);
  
  const [commitStatus, setCommitStatus] = useState<'idle' | 'committing' | 'committed' | 'approving' | 'revealing' | 'done'>('idle');
  const [commitmentData, setCommitmentData] = useState<CommitmentInfo | null>(null);
  const [revealBlock, setRevealBlock] = useState<number>(0);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [blocksRemaining, setBlocksRemaining] = useState<number>(BATCH_DURATION);
  
  const [modal, setModal] = useState<TransactionModal>({
    isOpen: false,
    type: null,
    status: 'pending',
  });
  
  const [needsApproval, setNeedsApproval] = useState(false);
  
  const { writeContract, data: txHash, isPending, error: writeError, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: ethBalance } = useBalance({ address });
  const { data: usdcBalance } = useBalance({ 
    address, 
    token: TOKENS.USDC.address as `0x${string}` 
  });
  
  // Check allowance - use commitmentData.fromToken, not current fromToken state!
  const { data: allowance } = useReadContract({
    address: commitStatus === 'committed' && commitmentData
      ? (commitmentData.fromToken === 'USDC' ? TOKENS.USDC.address : TOKENS.WETH.address) as `0x${string}`
      : undefined,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && commitmentData ? [address, ROUTER_ADDRESS] : undefined,
    query: {
      enabled: !!address && commitStatus === 'committed' && !!commitmentData,
    }
  });

  useEffect(() => {
    if (commitStatus === 'committed' && commitmentData && allowance !== undefined) {
      const needsApprove = allowance < commitmentData.amount;
      setNeedsApproval(needsApprove);
      console.log('Allowance check:', {
        token: commitmentData.fromToken,
        allowance: allowance.toString(),
        amount: commitmentData.amount.toString(),
        needsApproval: needsApprove
      });
    }
  }, [allowance, commitmentData, commitStatus]);

  const getBalance = (token: string) => {
    if (!isConnected) return '--';
    const balance = token === 'ETH' ? ethBalance : usdcBalance;
    if (!balance) return '--';
    return parseFloat(formatUnits(balance.value, balance.decimals)).toFixed(4);
  };

  useEffect(() => {
    const fetchBlock = async () => {
      if (window.ethereum) {
        try {
          const block = await window.ethereum.request({ method: 'eth_blockNumber' });
          const blockNum = parseInt(block, 16);
          setCurrentBlock(blockNum);
          if (revealBlock > 0) {
            setBlocksRemaining(Math.max(0, revealBlock - blockNum));
          }
        } catch (e) {
          console.error('Failed to fetch block:', e);
        }
      }
    };
    
    fetchBlock();
    const interval = setInterval(fetchBlock, 5000);
    return () => clearInterval(interval);
  }, [revealBlock]);

  useEffect(() => {
    if (isConfirming && modal.isOpen) {
      setModal(prev => ({ ...prev, status: 'pending' }));
    }
    if (isConfirmed && modal.isOpen) {
      setModal(prev => ({ ...prev, status: 'success', hash: txHash }));
      
      if (modal.type === 'commit') {
        setCommitStatus('committed');
      } else if (modal.type === 'approve') {
        setCommitStatus('committed');
        setNeedsApproval(false);
      } else if (modal.type === 'reveal') {
        setCommitStatus('done');
        localStorage.removeItem('privyflow_commitment');
        setTimeout(() => {
          setCommitStatus('idle');
          setCommitmentData(null);
          setRevealBlock(0);
          setAmount('');
          setManualSalt('');
        }, 3000);
      }
    }
    if (writeError && modal.isOpen) {
      setModal(prev => ({ ...prev, status: 'error', error: writeError.message }));
    }
  }, [isConfirming, isConfirmed, writeError, modal.isOpen, modal.type, txHash]);

  // Load saved commitment on mount
  useEffect(() => {
    const saved = localStorage.getItem('privyflow_commitment');
    console.log('Loaded from localStorage:', saved);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        console.log('Parsed localStorage data:', parsed);
        console.log('Salt from localStorage:', parsed.salt);
        console.log('Salt as BigInt:', BigInt(parsed.salt).toString());
        setCommitmentData({
          commitment: parsed.commitment,
          nullifier: parsed.nullifier,
          salt: BigInt(parsed.salt),
          amount: BigInt(parsed.amount),
          minOut: BigInt(parsed.minOut),
          fromToken: parsed.fromToken,
          toToken: parsed.toToken,
        });
        setRevealBlock(parsed.revealBlock);
        setCommitStatus('committed');
        setFromToken(parsed.fromToken);
        setToToken(parsed.toToken);
      } catch (e) {
        console.error('Failed to load saved commitment:', e);
        localStorage.removeItem('privyflow_commitment');
      }
    }
  }, []);

  const switchTokens = () => {
    setFromToken(toToken === 'ETH' ? 'WETH' : toToken);
    setToToken(fromToken === 'WETH' ? 'ETH' : fromToken);
    setAmount('');
  };

  const calculateOutput = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) return '';
    const rate = fromToken === 'ETH' ? 2000 : 0.0005;
    return (parseFloat(amount) * rate).toFixed(6);
  }, [amount, fromToken]);

  const calculateMinOut = () => {
    if (!amount || parseFloat(amount) <= 0) return 0n;
    const output = parseFloat(calculateOutput());
    const slippageVal = parseFloat(slippage);
    const minOut = output * (1 - slippageVal / 100);
    return parseUnits(minOut.toFixed(6), TOKENS[toToken].decimals);
  };

  const handleCommit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected || !address) return;

    setModal({ isOpen: true, type: 'commit', status: 'pending' });
    setCommitStatus('committing');
    reset();

    try {
      const amountIn = parseUnits(amount, TOKENS[fromToken].decimals);
      const minOut = calculateMinOut();
      const salt = BigInt(Math.floor(Math.random() * 10000000000000000000));
      
      console.log('');
      console.log('========================================');
      console.log('COMMIT PHASE:');
      console.log('========================================');
      console.log('Generated salt:', salt.toString());
      console.log('Salt type:', typeof salt);
      console.log('Amount:', amountIn.toString());
      console.log('MinOut:', minOut.toString());
      console.log('========================================');
      
      const commitment = keccak256(
        encodePacked(['uint256', 'uint256', 'uint256'], [amountIn, minOut, salt])
      ) as `0x${string}`;
      
      const nullifier = keccak256(
        encodePacked(['uint256'], [salt])
      ) as `0x${string}`;
      
      writeContract({
        address: COMMIT_STORE_ADDRESS,
        abi: COMMIT_STORE_ABI,
        functionName: 'commit',
        args: [commitment, nullifier],
      });
      
      const commitmentInfo: CommitmentInfo = {
        commitment,
        nullifier,
        salt,
        amount: amountIn,
        minOut,
        fromToken,
        toToken,
      };
      
      setCommitmentData(commitmentInfo);
      
      const targetBlock = currentBlock + BATCH_DURATION;
      setRevealBlock(targetBlock);
      
      // Save to localStorage
      const storageData = {
        commitment,
        nullifier,
        salt: salt.toString(),
        amount: amountIn.toString(),
        minOut: minOut.toString(),
        fromToken,
        toToken,
        revealBlock: targetBlock,
      };
      console.log('Saving to localStorage:', storageData);
      localStorage.setItem('privyflow_commitment', JSON.stringify(storageData));
      
    } catch (error) {
      console.error('Commit error:', error);
      setModal(prev => ({ ...prev, status: 'error', error: (error as Error).message }));
      setCommitStatus('idle');
    }
  };

  const handleApprove = async () => {
    if (!commitmentData || !isConnected) return;
    
    setModal({ isOpen: true, type: 'approve', status: 'pending' });
    setCommitStatus('approving');
    reset();
    
    const tokenAddress = commitmentData.fromToken === 'USDC' ? TOKENS.USDC.address : TOKENS.WETH.address;
    
    writeContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [ROUTER_ADDRESS, commitmentData.amount],
    });
  };

  const handleReveal = async () => {
    if (!commitmentData || !isConnected || !address) return;
    
    // Check if we need approval first
    if (needsApproval) {
      await handleApprove();
      return;
    }
    
    setModal({ isOpen: true, type: 'reveal', status: 'pending' });
    setCommitStatus('revealing');
    reset();
    
    try {
      // Use manual salt if provided and not empty
      const saltToUse = manualSalt && manualSalt.trim() !== '' 
        ? BigInt(manualSalt.trim()) 
        : commitmentData.salt;
      
      console.log('Salt selection:');
      console.log('  manualSalt raw:', JSON.stringify(manualSalt));
      console.log('  manualSalt trimmed:', manualSalt ? manualSalt.trim() : '(null/empty)');
      console.log('  Using manual salt?:', !!(manualSalt && manualSalt.trim() !== ''));
      console.log('  Final saltToUse:', saltToUse.toString());
      
      console.log('Revealing with:', {
        commitment: commitmentData.commitment,
        salt: saltToUse.toString(),
        minOut: commitmentData.minOut.toString(),
        amount: commitmentData.amount.toString(),
      });
      
      // DEBUG: Show what's being hashed
      console.log('Debug - Encoding:', encodePacked(['uint256', 'uint256', 'uint256'], [commitmentData.amount, commitmentData.minOut, saltToUse]));
      
      // Verify the commitment matches
      const recomputedCommitment = keccak256(
        encodePacked(['uint256', 'uint256', 'uint256'], [commitmentData.amount, commitmentData.minOut, saltToUse])
      );
      
      if (recomputedCommitment.toLowerCase() !== commitmentData.commitment.toLowerCase()) {
        console.error('Commitment mismatch!');
        console.error('Stored commitment:', commitmentData.commitment);
        console.error('Recomputed:', recomputedCommitment);
        console.error('Amount used:', commitmentData.amount.toString());
        console.error('MinOut used:', commitmentData.minOut.toString());
        console.error('Salt used:', saltToUse.toString());
        
        // Show detailed error in modal
        const errorMsg = manualSalt 
          ? `Salt mismatch! The salt "${manualSalt}" doesn't match the commitment. Try without manual salt, or verify your saved salt.`
          : `Commitment verification failed! Stored: ${commitmentData.commitment.slice(0,20)}... Recomputed: ${recomputedCommitment.slice(0,20)}... This can happen if you changed slippage after committing.`;
        
        setModal(prev => ({ 
          ...prev, 
          status: 'error', 
          error: errorMsg
        }));
        setCommitStatus('committed');
        return;
      }
      
      const currency0 = TOKENS.USDC.address;
      const currency1 = TOKENS.WETH.address;
      const zeroForOne = commitmentData.fromToken === 'USDC';
      
      const poolKey = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: HOOK_ADDRESS,
      };
      
      const hookData = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'uint256' }, { type: 'uint256' }],
        [commitmentData.commitment, saltToUse, commitmentData.minOut]
      );
      
      // FIX: Use proper sqrtPriceLimitX96 based on swap direction
      // For zeroForOne=true (USDC->WETH): use MIN_SQRT_PRICE + 1 (price goes down)
      // For zeroForOne=false (WETH->USDC): use MAX_SQRT_PRICE - 1 (price goes up)
      const sqrtPriceLimitX96 = zeroForOne 
        ? MIN_SQRT_PRICE + 1n  // MIN_SQRT_PRICE + 1
        : MAX_SQRT_PRICE - 1n; // MAX_SQRT_PRICE - 1
      
      // DEBUG: Log all final params before sending
      console.log('');
      console.log('========================================');
      console.log('FINAL REVEAL PARAMS:');
      console.log('========================================');
      console.log('Commitment:', commitmentData.commitment);
      console.log('Salt being sent:', saltToUse.toString());
      console.log('Salt from commitmentData:', commitmentData.salt.toString());
      console.log('Manual salt input:', manualSalt || '(empty)');
      console.log('Using manual salt:', !!manualSalt);
      console.log('Amount:', commitmentData.amount.toString());
      console.log('MinOut:', commitmentData.minOut.toString());
      console.log('zeroForOne:', zeroForOne);
      console.log('sqrtPriceLimitX96:', sqrtPriceLimitX96.toString());
      console.log('Hook data:', hookData);
      console.log('========================================');
      console.log('');
      
      writeContract({
        address: ROUTER_ADDRESS,
        abi: ROUTER_ABI,
        functionName: 'swap',
        args: [
          poolKey,
          { 
            zeroForOne, 
            amountSpecified: commitmentData.amount,
            sqrtPriceLimitX96
          },
          hookData
        ],
      });
      
    } catch (error) {
      console.error('Reveal error:', error);
      setModal(prev => ({ ...prev, status: 'error', error: (error as Error).message }));
      setCommitStatus('committed');
    }
  };

  const closeModal = () => {
    setModal(prev => ({ ...prev, isOpen: false }));
  };

  const getButtonState = () => {
    if (!isConnected) {
      return { text: 'Connect Wallet', disabled: true, action: () => {} };
    }
    if (!amount || parseFloat(amount) <= 0) {
      return { text: 'Enter an amount', disabled: true, action: () => {} };
    }
    if (commitStatus === 'committing' || commitStatus === 'approving' || commitStatus === 'revealing' || (modal.isOpen && modal.status === 'pending')) {
      return { text: 'Confirming...', disabled: true, action: () => {} };
    }
    if (commitStatus === 'committed') {
      if (blocksRemaining > 0) {
        return { text: `Wait ${blocksRemaining} blocks`, disabled: true, action: () => {} };
      }
      if (needsApproval) {
        return { text: 'Approve Token', disabled: false, action: handleApprove };
      }
      // Check if manual salt is set but doesn't verify
      if (manualSalt && commitmentData) {
        try {
          const test = keccak256(encodePacked(['uint256', 'uint256', 'uint256'], [commitmentData.amount, commitmentData.minOut, BigInt(manualSalt)]));
          if (test.toLowerCase() !== commitmentData.commitment.toLowerCase()) {
            return { text: 'Fix Salt to Reveal', disabled: true, action: () => {} };
          }
        } catch {
          return { text: 'Invalid Salt', disabled: true, action: () => {} };
        }
      }
      return { text: 'Reveal Swap', disabled: false, action: handleReveal };
    }
    if (commitStatus === 'done') {
      return { text: 'Swap Complete', disabled: true, action: () => {} };
    }
    return { text: 'Commit Swap', disabled: false, action: handleCommit };
  };

  const buttonState = getButtonState();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 px-4">
      {/* Token Selector Modal */}
      <TokenSelector
        isOpen={showTokenSelector === 'from'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token) => {
          // If selecting ETH for 'from', use WETH internally
          setFromToken(token === 'ETH' ? 'WETH' : token);
          if (token === toToken || (token === 'ETH' && toToken === 'WETH') || (token === 'WETH' && toToken === 'ETH')) {
            setToToken(fromToken === 'WETH' ? 'ETH' : fromToken);
          }
        }}
        excludeToken={toToken === 'WETH' ? 'ETH' : toToken}
      />
      <TokenSelector
        isOpen={showTokenSelector === 'to'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token) => {
          // If selecting ETH for 'to', use WETH internally
          setToToken(token === 'ETH' ? 'WETH' : token);
          if (token === fromToken || (token === 'ETH' && fromToken === 'WETH') || (token === 'WETH' && fromToken === 'ETH')) {
            setFromToken(toToken === 'WETH' ? 'ETH' : toToken);
          }
        }}
        excludeToken={fromToken === 'WETH' ? 'ETH' : fromToken}
      />

      {/* Transaction Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                {modal.type === 'commit' ? 'Committing Swap' : 
                 modal.type === 'approve' ? 'Approving Token' : 'Revealing Swap'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex flex-col items-center py-10">
              {modal.status === 'pending' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center mb-6">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                  </div>
                  <p className="text-gray-800 font-semibold text-lg">Waiting for confirmation...</p>
                  <p className="text-gray-500 mt-2">Please confirm in your wallet</p>
                </>
              )}
              
              {modal.status === 'success' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mb-6">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-gray-800 font-semibold text-lg">
                    {modal.type === 'commit' ? 'Commitment Submitted!' : 
                     modal.type === 'approve' ? 'Token Approved!' : 'Swap Revealed!'}
                  </p>
                  
                  {/* Show salt after successful commit */}
                  {modal.type === 'commit' && commitmentData && (
                    <div className="mt-4 w-full max-w-sm mx-auto">
                      <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                        <p className="text-red-600 font-bold text-sm mb-2">🔐 SAVE YOUR SALT!</p>
                        <code className="block bg-white rounded-lg p-3 font-mono text-sm break-all text-gray-800">
                          {commitmentData.salt.toString()}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(commitmentData.salt.toString());
                            alert('Salt copied!');
                          }}
                          className="mt-2 w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-semibold"
                        >
                          Copy Salt
                        </button>
                        <p className="text-red-600 text-xs mt-2">
                          ⚠️ You need this salt to reveal. Save it now!
                        </p>
                      </div>
                    </div>
                  )}
                  
                  {modal.hash && (
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${modal.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-500 hover:text-pink-600 text-sm mt-3 font-medium block"
                    >
                      View on Etherscan →
                    </a>
                  )}
                  <button 
                    onClick={closeModal}
                    className="mt-6 px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/25 transition-all"
                  >
                    Close
                  </button>
                </>
              )}
              
              {modal.status === 'error' && (
                <>
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-400 to-rose-500 flex items-center justify-center mb-6">
                    <X className="w-10 h-10 text-white" />
                  </div>
                  <p className="text-gray-800 font-semibold text-lg">Transaction Failed</p>
                  <p className="text-gray-500 mt-2 text-center max-w-xs text-sm">
                    {modal.error || 'Something went wrong. Please try again.'}
                  </p>
                  <button 
                    onClick={closeModal}
                    className="mt-8 px-8 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl font-semibold transition-colors"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Swap Card */}
      <div className="max-w-lg mx-auto">
        <div className="flex justify-between items-center mb-4 px-2">
          <h1 className="text-2xl font-bold text-gray-800">Swap</h1>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-2xl bg-white shadow-sm border border-gray-200 text-gray-600 hover:text-gray-800 hover:shadow-md transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        {showSettings && (
          <div className="bg-white rounded-2xl p-5 mb-4 shadow-lg border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <span className="text-gray-800 font-semibold">Slippage Tolerance</span>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              {['50', '100'].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                        if (commitStatus !== 'idle' && s !== slippage) {
                          alert('⚠️ Changing slippage will change minOut and break your pending commitment! Reset the swap first if you want to change slippage.');
                          return;
                        }
                        setSlippage(s);
                      }}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    slippage === s
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s === '100' ? '100% (No Limit)' : `${s}%`}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500">
              100% slippage allows any price impact. Required for current pool state.
            </p>
          </div>
        )}

        {/* Info Banner */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
          <p className="text-sm text-blue-800 font-medium">
            💡 Swap <strong>ETH → USDC</strong> with <strong>100% slippage</strong> for best results. 
            The pool price is at minimum, so USDC→ETH swaps may fail.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100">
          {/* From Token */}
          <div className="bg-gray-50 rounded-2xl p-4 mb-3">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">You pay</span>
              <span className="text-gray-500 text-sm font-medium">
                Balance: {getBalance(fromToken)} {fromToken}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*[.]?[0-9]*"
                value={amount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setAmount(value);
                  }
                }}
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-4xl text-gray-800 placeholder-gray-300 outline-none font-light"
                disabled={commitStatus !== 'idle'}
              />
              <button 
                onClick={() => setShowTokenSelector('from')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                disabled={commitStatus !== 'idle'}
              >
                <img 
                  src={TOKEN_INFO[fromToken].icon} 
                  alt={fromToken}
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-lg">{fromToken}</span>
                {commitStatus === 'idle' && <span className="text-gray-400 text-xs">▼</span>}
              </button>
            </div>
            <div className="text-gray-400 text-sm mt-2 font-medium">
              ${amount ? (parseFloat(amount) * (fromToken === 'ETH' ? 2000 : 1)).toFixed(2) : '0.00'}
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10">
            <button
              onClick={switchTokens}
              disabled={commitStatus !== 'idle'}
              className="p-2.5 bg-white border-2 border-gray-100 shadow-md rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ArrowDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* To Token */}
          <div className="bg-gray-50 rounded-2xl p-4 mt-3">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">You receive (min)</span>
              <span className="text-gray-500 text-sm font-medium">
                Balance: {getBalance(toToken)} {toToken}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={calculateOutput()}
                readOnly
                placeholder="0"
                className="flex-1 min-w-0 bg-transparent text-4xl text-gray-800 placeholder-gray-300 outline-none font-light"
              />
              <button 
                onClick={() => setShowTokenSelector('to')}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all whitespace-nowrap"
                disabled={commitStatus !== 'idle'}
              >
                <img 
                  src={TOKEN_INFO[toToken].icon} 
                  alt={toToken}
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-lg">{toToken}</span>
                {commitStatus === 'idle' && <span className="text-gray-400 text-xs">▼</span>}
              </button>
            </div>
            <div className="text-gray-400 text-sm mt-2 font-medium">
              Min: {calculateOutput() ? (parseFloat(calculateOutput()) * (1 - parseFloat(slippage) / 100)).toFixed(6) : '0.00'} {toToken}
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 mx-2 mb-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>Rate: 1 {fromToken} ≈ {fromToken === 'ETH' ? '2,000' : '0.0005'} {toToken}</span>
            </div>
            <span className="text-sm font-semibold text-pink-600">Slippage: {slippage}%</span>
          </div>

          <div className="mt-2">
            <button
              onClick={buttonState.action}
              disabled={buttonState.disabled}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                buttonState.disabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : commitStatus === 'committed' && needsApproval
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-orange-500/25'
                  : commitStatus === 'committed' && blocksRemaining === 0
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-green-500/25'
                  : 'bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white shadow-pink-500/25'
              }`}
            >
              {buttonState.text}
            </button>
          </div>
        </div>

        {commitStatus !== 'idle' && commitmentData && (
          <div className="mt-5 bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
            <div className="flex items-center gap-4 mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                commitStatus === 'done' 
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500' 
                  : commitStatus === 'approving'
                  ? 'bg-gradient-to-br from-orange-400 to-amber-500'
                  : 'bg-gradient-to-br from-pink-400 to-rose-500'
              }`}>
                {commitStatus === 'done' 
                  ? <CheckCircle className="w-6 h-6 text-white" /> 
                  : commitStatus === 'approving'
                  ? <Loader2 className="w-6 h-6 text-white animate-spin" />
                  : <Clock className="w-6 h-6 text-white" />
                }
              </div>
              <div>
                <div className="text-gray-800 font-bold text-lg">
                  {commitStatus === 'committing' && 'Committing...'}
                  {commitStatus === 'committed' && (needsApproval ? 'Approval Required' : 'Waiting to reveal')}
                  {commitStatus === 'approving' && 'Approving...'}
                  {commitStatus === 'revealing' && 'Revealing...'}
                  {commitStatus === 'done' && 'Swap complete!'}
                </div>
                <div className="text-gray-500 text-sm font-medium">
                  {commitStatus === 'committed' && blocksRemaining > 0 
                    ? `${blocksRemaining} blocks remaining`
                    : commitStatus === 'committed' && needsApproval
                    ? 'Approve token to continue'
                    : commitStatus === 'committed' 
                    ? 'Ready to reveal!'
                    : ''}
                </div>
              </div>
            </div>

            {commitStatus === 'committed' && (
              <div className="mb-5">
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-400 to-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, ((BATCH_DURATION - blocksRemaining) / BATCH_DURATION) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <button
                    onClick={() => {
                      if (confirm('Clear this commitment and start over? You will lose the ability to reveal this swap.')) {
                        localStorage.removeItem('privyflow_commitment');
                        setCommitStatus('idle');
                        setCommitmentData(null);
                        setRevealBlock(0);
                        setManualSalt('');
                        setAmount('');
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-500 underline"
                  >
                    Reset / Start Over
                  </button>
                </div>
              </div>
            )}

            {/* Salt Display */}
            <SaltDisplay 
              commitmentData={commitmentData} 
              manualSalt={manualSalt} 
              onToggleInput={() => setShowSaltInput(!showSaltInput)} 
              showInput={showSaltInput}
            />

            {/* Manual Salt Input */}
            {showSaltInput && (
              <div className="bg-yellow-50 rounded-2xl p-4 border border-yellow-200 mb-4">
                <label className="text-yellow-800 text-xs font-bold uppercase tracking-wider mb-2 block">
                  Enter Saved Salt (if reveal fails)
                </label>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={manualSalt}
                    onChange={(e) => setManualSalt(e.target.value)}
                    placeholder="Enter salt number..."
                    className="flex-1 px-3 py-2 bg-white rounded-xl text-gray-800 outline-none border border-yellow-300 focus:border-yellow-500 text-sm"
                  />
                  <button
                    onClick={() => {
                      if (manualSalt && commitmentData) {
                        try {
                          const salt = BigInt(manualSalt);
                          // Verify this salt produces the correct commitment
                          const testCommitment = keccak256(
                            encodePacked(['uint256', 'uint256', 'uint256'], [commitmentData.amount, commitmentData.minOut, salt])
                          );
                          if (testCommitment.toLowerCase() === commitmentData.commitment.toLowerCase()) {
                            alert('✅ Salt verified! This salt is correct.');
                          } else {
                            alert('❌ Salt does not match commitment. The commitment hash would be: ' + testCommitment);
                          }
                        } catch {
                          alert('Invalid salt number');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors text-sm"
                  >
                    Verify
                  </button>
                </div>
                <p className="text-xs text-yellow-700">
                  Commitment: {commitmentData?.commitment.slice(0, 20)}...<br/>
                  Amount: {commitmentData?.amount.toString()}<br/>
                  MinOut: {commitmentData?.minOut.toString()}
                </p>
              </div>
            )}

            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-2">Commitment</div>
              <code className="text-gray-600 font-mono text-xs break-all">
                {commitmentData.commitment}
              </code>
            </div>
          </div>
        )}

        <div className="mt-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-100">
          <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2 text-lg">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm">?</span>
            How PrivyFlow Works
          </h3>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm font-bold shrink-0">1</div>
              <div>
                <div className="text-gray-800 font-semibold">Commit</div>
                <div className="text-gray-500 text-sm">Hide your swap amount using a cryptographic commitment</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">2</div>
              <div>
                <div className="text-gray-800 font-semibold">Wait</div>
                <div className="text-gray-500 text-sm">{BATCH_DURATION} block delay prevents MEV frontrunning</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-sm font-bold shrink-0">3</div>
              <div>
                <div className="text-gray-800 font-semibold">Approve & Reveal</div>
                <div className="text-gray-500 text-sm">Approve token, then execute the swap with your secret salt</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
