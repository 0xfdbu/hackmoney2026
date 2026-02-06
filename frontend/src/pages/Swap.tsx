import React, { useState, useCallback } from 'react';
import { ArrowDownUp, Shield, Loader2, AlertCircle } from 'lucide-react';
import { useAccount, useBalance, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, encodeAbiParameters } from 'viem';
import * as snarkjs from 'snarkjs';
import { HOOK_ADDRESS, POOL_MANAGER_ADDRESS, VERIFIER_ADDRESS } from '../contracts/constants';

const TOKENS = {
  ETH: { address: '0x0000000000000000000000000000000000000000', decimals: 18, symbol: 'ETH' },
  USDC: { address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6, symbol: 'USDC' },
};

const POOL_MANAGER_ABI = [
  {
    inputs: [
      { components: [{ name: 'currency0', type: 'address' }, { name: 'currency1', type: 'address' }, { name: 'fee', type: 'uint24' }, { name: 'tickSpacing', type: 'int24' }, { name: 'hooks', type: 'address' }], name: 'key', type: 'tuple' },
      { components: [{ name: 'zeroForOne', type: 'bool' }, { name: 'amountSpecified', type: 'int256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' }], name: 'params', type: 'tuple' },
      { name: 'hookData', type: 'bytes' }
    ],
    name: 'swap',
    outputs: [{ name: 'delta', type: 'int256' }],
    stateMutability: 'payable',
    type: 'function'
  }
] as const;

const HOOK_ABI = [
  {
    inputs: [{ name: 'batchId', type: 'uint256' }],
    name: 'getBatchInfo',
    outputs: [{ name: 'commitmentCount', type: 'uint256' }, { name: 'settled', type: 'bool' }, { name: 'clearingPrice', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  },
  {
    inputs: [],
    name: 'currentBatchId',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function'
  }
] as const;

// Generate ZK Proof
const generateProof = async (input: {
  amount_in: bigint;
  min_amount_out: bigint;
  salt: bigint;
  private_key: bigint;
  batch_id: bigint;
  max_price_impact: bigint;
  oracle_price: bigint;
}) => {
  console.log('Generating proof with inputs:', {
    amount_in: input.amount_in.toString(),
    min_amount_out: input.min_amount_out.toString(),
    salt: input.salt.toString(),
    private_key: input.private_key.toString(),
    batch_id: input.batch_id.toString(),
    max_price_impact: input.max_price_impact.toString(),
    oracle_price: input.oracle_price.toString(),
  });
  
  // Add cache busting to force fresh download of circuit files
  const cacheBuster = `?v=${Date.now()}`;
  const wasmResponse = await fetch(`/darkpool.wasm${cacheBuster}`);
  const zkeyResponse = await fetch(`/darkpool_final.zkey${cacheBuster}`);
  
  const wasm = new Uint8Array(await wasmResponse.arrayBuffer());
  const zkey = new Uint8Array(await zkeyResponse.arrayBuffer());
  
  console.log('WASM size:', wasm.length, 'ZKEY size:', zkey.length);

  const { proof, publicSignals } = await snarkjs.groth16.fullProve({
    amount_in: input.amount_in.toString(),
    min_amount_out: input.min_amount_out.toString(),
    salt: input.salt.toString(),
    private_key: input.private_key.toString(),
    batch_id: input.batch_id.toString(),
    max_price_impact: input.max_price_impact.toString(),
    oracle_price: input.oracle_price.toString(),
  }, wasm, zkey);
  
  console.log('Raw public signals from snarkjs:', publicSignals);
  
  // Verify the proof locally
  try {
    const vkeyResponse = await fetch(`/verification_key.json${cacheBuster}`);
    const vkey = await vkeyResponse.json();
    const verified = await snarkjs.groth16.verify(vkey, publicSignals, proof);
    console.log('Local proof verification:', verified);
  } catch (e) {
    console.error('Local verification failed:', e);
  }

  return { proof, publicSignals };
};

export default function DarkPoolSwap() {
  const { address, isConnected } = useAccount();
  const [fromToken, setFromToken] = useState<keyof typeof TOKENS>('ETH');
  const [toToken, setToToken] = useState<keyof typeof TOKENS>('USDC');
  const [amount, setAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [isGeneratingProof, setIsGeneratingProof] = useState(false);
  const [txHash, setTxHash] = useState('');

  const { data: balance } = useBalance({ 
    address, 
    token: fromToken === 'ETH' ? undefined : TOKENS[fromToken].address 
  });

  const { data: currentBatchId } = useReadContract({
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

  const { writeContract, isPending } = useWriteContract();

  const handleCommit = async () => {
    if (!isConnected || !amount) {
      alert('Please connect wallet and enter amount');
      return;
    }
    
    if (!currentBatchId) {
      alert('Waiting for batch info...');
      return;
    }
    
    console.log('Current batch ID:', currentBatchId.toString());
    
    setIsGeneratingProof(true);
    
    try {
      const amountIn = parseUnits(amount, TOKENS[fromToken].decimals);
      const minOut = parseUnits(
        (parseFloat(amount) * 0.995).toFixed(6), 
        TOKENS[toToken].decimals
      );
      
      // Generate random salt and private key for nullifier
      const salt = BigInt(Math.floor(Math.random() * 1000000000));
      const privateKey = BigInt(Math.floor(Math.random() * 1000000000));
      
      // Mock oracle price (2000 USDC/ETH)
      const oraclePrice = 2000n * 10n**8n; // 8 decimals like Chainlink
      
      // Ensure batch_id is a proper BigInt
      const batchIdBigInt = BigInt(currentBatchId?.toString() || '0');
      console.log('Using batch_id for proof:', batchIdBigInt.toString());
      
      // Convert slippage percentage to basis points (10000 = 100%)
      const slippageBps = BigInt(Math.round(parseFloat(slippage) * 100));
      console.log('Slippage:', slippage, '% =', slippageBps.toString(), 'bps');
      
      const { proof, publicSignals } = await generateProof({
        amount_in: amountIn,
        min_amount_out: minOut,
        salt,
        private_key: privateKey,
        batch_id: batchIdBigInt,
        max_price_impact: slippageBps,
        oracle_price: oraclePrice,
      });

      // Encode hook data for verifier
      // snarkjs returns: pi_a[3], pi_b[3][2], pi_c[3]
      // We need: a[2], b[2][2], c[2]
      // The last element of each is a marker ("1") that we drop
      
      console.log('Proof structure:', {
        pi_a: proof.pi_a,
        pi_b: proof.pi_b,
        pi_c: proof.pi_c,
        publicSignals
      });
      
      // Format proof for verifier
      // a = [pi_a[0], pi_a[1]]
      // b = [[pi_b[0][0], pi_b[0][1]], [pi_b[1][0], pi_b[1][1]]] 
      // c = [pi_c[0], pi_c[1]]
      const a = [proof.pi_a[0], proof.pi_a[1]];
      const b = [
        [proof.pi_b[0][0], proof.pi_b[0][1]],
        [proof.pi_b[1][0], proof.pi_b[1][1]]
      ];
      const c = [proof.pi_c[0], proof.pi_c[1]];
      
      console.log('Formatted proof:', { a, b, c });
      
      // Note: Now we have 7 public signals with the new circuit
      const hookData = encodeAbiParameters(
        [
          { name: 'a', type: 'uint256[2]' },
          { name: 'b', type: 'uint256[2][2]' },
          { name: 'c', type: 'uint256[2]' },
          { name: 'publicSignals', type: 'uint256[7]' }  // Changed from 6 to 7
        ],
        [
          a as [string, string],
          b as [string[], string[]],
          c as [string, string],
          publicSignals.map((s: string) => BigInt(s))
        ]
      );

      // Submit to DarkPool - ensure correct token ordering
      // Pool requires currency0 < currency1 by address
      const ethAddr = TOKENS.ETH.address.toLowerCase();
      const usdcAddr = TOKENS.USDC.address.toLowerCase();
      const [currency0, currency1] = ethAddr < usdcAddr 
        ? [TOKENS.ETH.address, TOKENS.USDC.address]
        : [TOKENS.USDC.address, TOKENS.ETH.address];
      
      const poolKey = {
        currency0,
        currency1,
        fee: 3000,
        tickSpacing: 60,
        hooks: HOOK_ADDRESS,
      };
      
      console.log('Pool key:', poolKey);
      console.log('Hook data length:', hookData.length);
      console.log('Public signals (actual circuit order):');
      console.log('  [0] commitment:', publicSignals[0]);
      console.log('  [1] nullifier:', publicSignals[1]);
      console.log('  [2] batch_id:', publicSignals[2]);
      console.log('  [3] valid (should be 1):', publicSignals[3]);
      console.log('  [4] batch_id_out:', publicSignals[4]);
      console.log('  [5] max_price_impact:', publicSignals[5]);
      console.log('  [6] oracle_price:', publicSignals[6]);
      
      // Check valid flag at index 3
      if (publicSignals[3] !== '1') {
        console.warn('⚠️ Proof validation failed: signals[3] (valid) should be 1, got:', publicSignals[3]);
      } else {
        console.log('✅ Proof valid flag is correct (1)');
      }
      
      // zeroForOne: true if swapping token0 for token1
      const zeroForOne = fromToken === 'ETH' ? ethAddr === currency0.toLowerCase() : usdcAddr === currency0.toLowerCase();

      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'swap',
        args: [
          poolKey,
          { zeroForOne, amountSpecified: amountIn, sqrtPriceLimitX96: 0n },
          hookData
        ],
        value: fromToken === 'ETH' ? amountIn : 0n,
      });

      setIsGeneratingProof(false);
      
    } catch (err: any) {
      console.error('Commit failed:', err);
      console.error('Full error:', JSON.stringify(err, null, 2));
      
      // Try to extract more details
      let errorMsg = 'Unknown error';
      if (err.shortMessage) errorMsg = err.shortMessage;
      else if (err.message) errorMsg = err.message;
      else if (err.cause?.message) errorMsg = err.cause.message;
      
      if (err.revertReason) {
        errorMsg += ` (Revert: ${err.revertReason})`;
      }
      
      alert('Swap failed: ' + errorMsg);
      setIsGeneratingProof(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto p-6 bg-white rounded-2xl shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-6 h-6 text-purple-600" />
        <h2 className="text-2xl font-bold">DarkPool Swap</h2>
      </div>

      {/* Batch Status */}
      <div className="mb-4 p-3 bg-purple-50 rounded-lg">
        <p className="text-sm text-purple-800">
          Current Batch: {currentBatchId?.toString() || '...'}
        </p>
        <p className="text-sm text-purple-600">
          Commits: {batchInfo?.[0].toString() || '0'} | 
          Status: {batchInfo?.[1] ? 'Settled' : 'Open'}
        </p>
      </div>

      {/* Token Selection */}
      <div className="mb-4 flex gap-4">
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">From</label>
          <select
            value={fromToken}
            onChange={(e) => setFromToken(e.target.value as keyof typeof TOKENS)}
            className="w-full p-3 border rounded-lg"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        <div className="flex items-end pb-3">
          <ArrowDownUp className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium mb-1">To</label>
          <select
            value={toToken}
            onChange={(e) => setToToken(e.target.value as keyof typeof TOKENS)}
            className="w-full p-3 border rounded-lg"
          >
            <option value="USDC">USDC</option>
            <option value="ETH">ETH</option>
          </select>
        </div>
      </div>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Amount (Hidden)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.0"
          className="w-full p-3 border rounded-lg"
        />
        <p className="text-xs text-gray-500 mt-1">
          Balance: {balance ? formatUnits(balance.value, TOKENS[fromToken].decimals) : '0'} {TOKENS[fromToken].symbol}
        </p>
      </div>

      {/* Slippage */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Max Slippage (Hidden)</label>
        <div className="flex gap-2 mb-2">
          {['0.5', '1.0', '2.0', '5.0', '10.0', '50.0'].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-3 py-2 rounded-lg text-sm ${slippage === s ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
            >
              {s}%
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={slippage}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (val >= 0 && val <= 100) setSlippage(e.target.value);
            }}
            className="w-24 p-2 border rounded-lg text-sm"
          />
          <span className="text-sm text-gray-600">% (Custom: 0-100%)</span>
        </div>
        {parseFloat(slippage) > 10 && (
          <p className="text-xs text-orange-600 mt-1">
            ⚠️ High slippage warning! You may receive significantly less.
          </p>
        )}
      </div>

      {/* Submit */}
      <button
        onClick={handleCommit}
        disabled={isGeneratingProof || isPending || !amount}
        className="w-full py-4 bg-purple-600 text-white rounded-xl font-semibold disabled:opacity-50"
      >
        {isGeneratingProof ? (
          <><Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Generating ZK Proof...</>
        ) : isPending ? (
          'Submitting...'
        ) : (
          'Commit to DarkPool'
        )}
      </button>

      <p className="mt-4 text-xs text-center text-gray-500">
        Your amount and slippage are hidden via ZK proofs
      </p>
    </div>
  );
}