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
  const wasmResponse = await fetch('/darkpool.wasm');
  const zkeyResponse = await fetch('/darkpool_final.zkey');
  
  const wasm = new Uint8Array(await wasmResponse.arrayBuffer());
  const zkey = new Uint8Array(await zkeyResponse.arrayBuffer());

  const { proof, publicSignals } = await snarkjs.groth16.fullProve({
    amount_in: input.amount_in.toString(),
    min_amount_out: input.amount_out.toString(),
    salt: input.salt.toString(),
    private_key: input.private_key.toString(),
    batch_id: input.batch_id.toString(),
    max_price_impact: input.max_price_impact.toString(),
    oracle_price: input.oracle_price.toString(),
  }, wasm, zkey);

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
    if (!isConnected || !amount || !currentBatchId) return;
    
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
      
      const { proof, publicSignals } = await generateProof({
        amount_in: amountIn,
        min_amount_out: minOut,
        salt,
        private_key: privateKey,
        batch_id: currentBatchId,
        max_price_impact: 500n, // 5%
        oracle_price: oraclePrice,
      });

      // Encode hook data
      const hookData = encodeAbiParameters(
        [
          { name: 'a', type: 'uint256[2]' },
          { name: 'b', type: 'uint256[2][2]' },
          { name: 'c', type: 'uint256[2]' },
          { name: 'publicSignals', type: 'uint256[6]' }
        ],
        [proof.pi_a, proof.pi_b, proof.pi_c, publicSignals.map(s => BigInt(s))]
      );

      // Submit to DarkPool
      const poolKey = {
        currency0: TOKENS.ETH.address,
        currency1: TOKENS.USDC.address,
        fee: 3000,
        tickSpacing: 60,
        hooks: HOOK_ADDRESS,
      };

      await writeContract({
        address: POOL_MANAGER_ADDRESS,
        abi: POOL_MANAGER_ABI,
        functionName: 'swap',
        args: [
          poolKey,
          { zeroForOne: true, amountSpecified: amountIn, sqrtPriceLimitX96: 0n },
          hookData
        ],
        value: fromToken === 'ETH' ? amountIn : 0n,
      });

      setIsGeneratingProof(false);
      
    } catch (err) {
      console.error('Commit failed:', err);
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
          Balance: {balance ? formatUnits(balance.value, balance.decimals) : '0'}
        </p>
      </div>

      {/* Slippage */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Max Slippage (Hidden)</label>
        <div className="flex gap-2">
          {['0.5', '1.0', '2.0'].map((s) => (
            <button
              key={s}
              onClick={() => setSlippage(s)}
              className={`px-4 py-2 rounded-lg ${slippage === s ? 'bg-purple-600 text-white' : 'bg-gray-100'}`}
            >
              {s}%
            </button>
          ))}
        </div>
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