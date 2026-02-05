import React from 'react';
import { Shield, Loader2, CheckCircle } from 'lucide-react';
import { useWriteContract } from 'wagmi';
import { HOOK_ADDRESS, VERIFIER_ADDRESS } from '../../contracts/constants';
import { HOOK_ABI } from './abis';

interface DarkPoolBatchesProps {
  currentBatchId?: bigint;
  batchInfo?: {
    commitmentCount: bigint;
    settled: boolean;
    clearingPrice: bigint;
  };
  slot0SqrtPriceX96?: bigint;
  onSuccess: () => void;
}

export function DarkPoolBatches({
  currentBatchId,
  batchInfo,
  slot0SqrtPriceX96,
  onSuccess,
}: DarkPoolBatchesProps) {
  const { writeContract, isPending } = useWriteContract();
  const [loading, setLoading] = React.useState(false);

  const handleSettleBatch = async () => {
    if (!slot0SqrtPriceX96) return;
    setLoading(true);

    try {
      await writeContract(
        {
          address: HOOK_ADDRESS,
          abi: HOOK_ABI,
          functionName: 'settleBatch',
          args: [slot0SqrtPriceX96],
        },
        {
          onSuccess: () => {
            setLoading(false);
            onSuccess();
          },
          onError: () => {
            setLoading(false);
          },
        }
      );
    } catch {
      setLoading(false);
    }
  };

  const calculatePrice = (sqrtPrice: bigint) => {
    const price = Number(sqrtPrice) / 2 ** 96;
    return (price * price).toFixed(6);
  };

  return (
    <div className="space-y-4">
      {/* Batch Status Card */}
      <div className="bg-purple-50 rounded-xl border-2 border-purple-200 overflow-hidden">
        <div className="p-4 bg-purple-100 border-b border-purple-200">
          <h3 className="font-semibold text-purple-900 flex items-center gap-2">
            <Shield className="w-5 h-5" />
            DarkPool Batch #{currentBatchId?.toString() || '...'}
          </h3>
        </div>

        <div className="p-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-purple-700">
                {batchInfo?.commitmentCount.toString() || '0'}
              </p>
              <p className="text-xs text-purple-600 uppercase font-medium">Commitments</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className={`text-2xl font-bold ${batchInfo?.settled ? 'text-green-600' : 'text-blue-600'}`}>
                {batchInfo?.settled ? 'Closed' : 'Open'}
              </p>
              <p className="text-xs text-purple-600 uppercase font-medium">Status</p>
            </div>
            <div className="bg-white rounded-lg p-3 text-center shadow-sm">
              <p className="text-2xl font-bold text-purple-700">
                {batchInfo?.clearingPrice && batchInfo.clearingPrice > 0n
                  ? calculatePrice(batchInfo.clearingPrice)
                  : '-'}
              </p>
              <p className="text-xs text-purple-600 uppercase font-medium">Clearing Price</p>
            </div>
          </div>

          {/* Settle Button or Success State */}
          {!batchInfo?.settled ? (
            <button
              onClick={handleSettleBatch}
              disabled={isPending || loading || !batchInfo?.commitmentCount}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg font-medium transition-colors"
            >
              {loading || isPending ? (
                <>
                  <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                  Settling Batch...
                </>
              ) : (
                'Settle Batch & Execute Swaps'
              )}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-3 bg-green-100 text-green-700 rounded-lg font-medium">
              <CheckCircle className="w-5 h-5" />
              Batch Successfully Settled
            </div>
          )}

          {!batchInfo?.commitmentCount && !batchInfo?.settled && (
            <p className="text-center text-sm text-purple-600 mt-3">
              No commitments yet. Swaps will be batched here.
            </p>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-800 mb-3">How DarkPool Works</h4>
        <ol className="space-y-3">
          {[
            'Users submit encrypted swap intents with ZK proofs',
            'Commitments accumulate in batch for ~10 blocks',
            'Anyone can settle to execute all swaps at uniform price',
            'MEV-resistant: No front-running possible',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-600">
              <span className="flex-shrink-0 w-5 h-5 bg-gray-100 text-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Contract Info */}
      <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Verifier:</span>
          <span className="font-mono">{VERIFIER_ADDRESS.slice(0, 6)}...{VERIFIER_ADDRESS.slice(-4)}</span>
        </div>
        <div className="flex justify-between">
          <span>Hook:</span>
          <span className="font-mono">{HOOK_ADDRESS.slice(0, 6)}...{HOOK_ADDRESS.slice(-4)}</span>
        </div>
      </div>
    </div>
  );
}
