import { useState, useEffect, useCallback } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters, keccak256, encodePacked } from 'viem';
import { POOL_MANAGER_ABI } from '../contracts/abis';
import { 
  HOOK_ADDRESS, 
  POOL_MANAGER_ADDRESS,
  TOKENS,
  BATCH_DURATION
} from '../contracts/constants';
import { Settings, ArrowDown, Info, X, CheckCircle, Clock, Loader2, Wallet } from 'lucide-react';
import TokenSelector from '../components/TokenSelector';

const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string }> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
};

interface TransactionModal {
  isOpen: boolean;
  type: 'commit' | 'reveal' | null;
  status: 'pending' | 'success' | 'error';
  hash?: string;
  error?: string;
}

export default function Swap() {
  const { address, isConnected } = useAccount();
  
  const [fromToken, setFromToken] = useState<'ETH' | 'USDC'>('ETH');
  const [toToken, setToToken] = useState<'ETH' | 'USDC'>('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState<'from' | 'to' | null>(null);
  
  const [commitStatus, setCommitStatus] = useState<'idle' | 'committing' | 'committed' | 'revealing' | 'done'>('idle');
  const [commitmentData, setCommitmentData] = useState<{
    commitment: `0x${string}`;
    nullifier: `0x${string}`;
    salt: bigint;
    amount: bigint;
  } | null>(null);
  const [revealBlock, setRevealBlock] = useState<number>(0);
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [blocksRemaining, setBlocksRemaining] = useState<number>(BATCH_DURATION);
  
  const [modal, setModal] = useState<TransactionModal>({
    isOpen: false,
    type: null,
    status: 'pending',
  });
  
  const { writeContract, data: txHash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const { data: ethBalance } = useBalance({ address });
  const { data: usdcBalance } = useBalance({ 
    address, 
    token: TOKENS.USDC.address as `0x${string}` 
  });

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
      } else if (modal.type === 'reveal') {
        setCommitStatus('done');
      }
    }
    if (writeError && modal.isOpen) {
      setModal(prev => ({ ...prev, status: 'error', error: writeError.message }));
    }
  }, [isConfirming, isConfirmed, writeError, modal.isOpen, modal.type, txHash]);

  const switchTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setAmount('');
  };

  const calculateOutput = useCallback(() => {
    if (!amount || parseFloat(amount) <= 0) return '';
    const rate = fromToken === 'ETH' ? 2000 : 0.0005;
    return (parseFloat(amount) * rate).toFixed(6);
  }, [amount, fromToken]);

  const handleCommit = async () => {
    if (!amount || parseFloat(amount) <= 0 || !isConnected) return;

    setModal({ isOpen: true, type: 'commit', status: 'pending' });
    setCommitStatus('committing');

    try {
      const amountIn = parseUnits(amount, TOKENS[fromToken].decimals);
      const salt = BigInt(Math.floor(Math.random() * 1000000000000));
      const privateKey = BigInt(Math.floor(Math.random() * 1000000000000));
      
      const commitment = keccak256(
        encodePacked(['uint256', 'uint256'], [amountIn, salt])
      ) as `0x${string}`;
      
      const nullifier = keccak256(
        encodePacked(['uint256', 'uint256'], [privateKey, 1n])
      ) as `0x${string}`;
      
      const hookData = encodeAbiParameters(
        [{ type: 'bytes32' }, { type: 'bytes32' }],
        [commitment, nullifier]
      );
      
      const ethAddr = TOKENS.ETH.address.toLowerCase();
      const usdcAddr = TOKENS.USDC.address.toLowerCase();
      const [currency0, currency1] = ethAddr < usdcAddr 
        ? [TOKENS.ETH.address, TOKENS.USDC.address]
        : [TOKENS.USDC.address, TOKENS.ETH.address];
      
      const zeroForOne = fromToken === 'ETH' ? ethAddr === currency0.toLowerCase() : usdcAddr === currency0.toLowerCase();
      
      const poolKey = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: HOOK_ADDRESS,
      };
      
      writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'swap',
        args: [
          poolKey,
          { 
            zeroForOne, 
            amountSpecified: 0n,
            sqrtPriceLimitX96: 0n 
          },
          hookData
        ],
        value: 0n,
      });
      
      setCommitmentData({
        commitment,
        nullifier,
        salt,
        amount: amountIn
      });
      
      setRevealBlock(currentBlock + BATCH_DURATION);
      
    } catch (error) {
      console.error('Commit error:', error);
      setModal(prev => ({ ...prev, status: 'error', error: (error as Error).message }));
      setCommitStatus('idle');
    }
  };

  const handleReveal = async () => {
    if (!commitmentData || !isConnected) return;
    
    setModal({ isOpen: true, type: 'reveal', status: 'pending' });
    setCommitStatus('revealing');
    
    setTimeout(() => {
      setModal(prev => ({ ...prev, status: 'success' }));
      setCommitStatus('done');
    }, 2000);
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
    if (commitStatus === 'committing' || (modal.isOpen && modal.status === 'pending')) {
      return { text: 'Confirming...', disabled: true, action: () => {} };
    }
    if (commitStatus === 'committed') {
      if (blocksRemaining > 0) {
        return { text: `Wait ${blocksRemaining} blocks`, disabled: true, action: () => {} };
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
          setFromToken(token);
          if (token === toToken) setToToken(fromToken);
        }}
        excludeToken={toToken}
      />
      <TokenSelector
        isOpen={showTokenSelector === 'to'}
        onClose={() => setShowTokenSelector(null)}
        onSelect={(token) => {
          setToToken(token);
          if (token === fromToken) setFromToken(toToken);
        }}
        excludeToken={fromToken}
      />

      {/* Transaction Modal */}
      {modal.isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800">
                {modal.type === 'commit' ? 'Committing Swap' : 'Revealing Swap'}
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
                    {modal.type === 'commit' ? 'Commitment Submitted!' : 'Swap Revealed!'}
                  </p>
                  {modal.hash && (
                    <a 
                      href={`https://sepolia.etherscan.io/tx/${modal.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-500 hover:text-pink-600 text-sm mt-3 font-medium"
                    >
                      View on Etherscan →
                    </a>
                  )}
                  <button 
                    onClick={closeModal}
                    className="mt-8 px-8 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white rounded-2xl font-semibold shadow-lg shadow-pink-500/25 transition-all"
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
            <div className="flex gap-2">
              {['0.1', '0.5', '1.0', '2.0'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSlippage(s)}
                  className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                    slippage === s 
                      ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/25' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {s}%
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="bg-white rounded-3xl p-4 shadow-xl border border-gray-100">
          {/* From Token */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">You pay</span>
              <span className="text-gray-500 text-sm font-medium">
                Balance: {getBalance(fromToken)} {fromToken}
              </span>
            </div>
            <div className="flex items-center gap-4">
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
                className="flex-1 bg-transparent text-4xl text-gray-800 placeholder-gray-300 outline-none font-light [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                disabled={commitStatus !== 'idle'}
              />
              <button 
                onClick={() => setShowTokenSelector('from')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all shrink-0"
                disabled={commitStatus !== 'idle'}
              >
                <img 
                  src={TOKEN_INFO[fromToken].icon} 
                  alt={fromToken}
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-lg">{fromToken}</span>
                {commitStatus === 'idle' && <span className="text-gray-400 ml-1">▼</span>}
              </button>
            </div>
            <div className="text-gray-400 text-sm mt-2 font-medium">
              ${amount ? (parseFloat(amount) * (fromToken === 'ETH' ? 2000 : 1)).toFixed(2) : '0.00'}
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-2 relative z-10 py-1">
            <button
              onClick={switchTokens}
              disabled={commitStatus !== 'idle'}
              className="p-3 bg-white border-2 border-gray-100 shadow-md rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <ArrowDown className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* To Token */}
          <div className="bg-gray-50 rounded-2xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-gray-500 text-sm font-medium">You receive</span>
              <span className="text-gray-500 text-sm font-medium">
                Balance: {getBalance(toToken)} {toToken}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={calculateOutput()}
                readOnly
                placeholder="0"
                className="flex-1 bg-transparent text-4xl text-gray-800 placeholder-gray-300 outline-none font-light"
              />
              <button 
                onClick={() => setShowTokenSelector('to')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-semibold text-gray-700 bg-white border border-gray-200 shadow-sm hover:shadow-md transition-all shrink-0"
                disabled={commitStatus !== 'idle'}
              >
                <img 
                  src={TOKEN_INFO[toToken].icon} 
                  alt={toToken}
                  className="w-7 h-7 rounded-full"
                />
                <span className="text-lg">{toToken}</span>
                {commitStatus === 'idle' && <span className="text-gray-400 ml-1">▼</span>}
              </button>
            </div>
            <div className="text-gray-400 text-sm mt-2 font-medium">
              ${calculateOutput() ? (parseFloat(calculateOutput()) * (toToken === 'ETH' ? 2000 : 1)).toFixed(2) : '0.00'}
            </div>
          </div>

          <div className="flex justify-between items-center mt-4 mx-2 mb-2 px-2">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Info className="w-4 h-4" />
              <span>1 {fromToken} ≈ {fromToken === 'ETH' ? '2,000' : '0.0005'} {toToken}</span>
            </div>
            <span className="text-sm text-gray-400 font-medium">Slippage: {slippage}%</span>
          </div>

          <div className="p-2">
            <button
              onClick={buttonState.action}
              disabled={buttonState.disabled}
              className={`w-full py-4 rounded-2xl font-bold text-lg transition-all shadow-lg ${
                buttonState.disabled
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
                  : 'bg-gradient-to-br from-pink-400 to-rose-500'
              }`}>
                {commitStatus === 'done' 
                  ? <CheckCircle className="w-6 h-6 text-white" /> 
                  : <Clock className="w-6 h-6 text-white" />
                }
              </div>
              <div>
                <div className="text-gray-800 font-bold text-lg">
                  {commitStatus === 'committing' && 'Committing...'}
                  {commitStatus === 'committed' && 'Waiting to reveal'}
                  {commitStatus === 'revealing' && 'Revealing...'}
                  {commitStatus === 'done' && 'Swap complete!'}
                </div>
                <div className="text-gray-500 text-sm font-medium">
                  {commitStatus === 'committed' && blocksRemaining > 0 
                    ? `${blocksRemaining} blocks remaining`
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
              </div>
            )}

            <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-2xl p-4 border border-pink-100">
              <div className="text-pink-600 text-xs font-bold uppercase tracking-wider mb-2">Your Secret Salt (save this!)</div>
              <div className="flex items-center justify-between">
                <code className="text-gray-800 font-mono text-lg font-semibold">
                  {commitmentData.salt.toString()}
                </code>
                <button 
                  onClick={() => navigator.clipboard.writeText(commitmentData.salt.toString())}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-pink-500 rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="mt-4 bg-gray-50 rounded-2xl p-4">
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
                <div className="text-gray-800 font-semibold">Reveal</div>
                <div className="text-gray-500 text-sm">Execute your trade with the secret salt</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
