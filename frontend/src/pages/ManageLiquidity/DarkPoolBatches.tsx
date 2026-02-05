import React from 'react';
import { Shield, Loader2, CheckCircle } from 'lucide-react';

interface DarkPoolBatchesProps {
  currentBatchId?: bigint;
  batchInfo?: { commitmentCount: bigint; settled: boolean; clearingPrice: bigint };
  onSettle: () => void;
  loading?: boolean;
}

export function DarkPoolBatches({ currentBatchId, batchInfo, onSettle, loading }: DarkPoolBatchesProps) {
  return (
    <div className="bg-purple-50 rounded-xl border-2 border-purple-200 p-4">
      <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5" />
        Batch #{currentBatchId?.toString() || '...'}
      </h3>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded p-3 text-center">
          <p className="text-xl font-bold text-purple-700">{batchInfo?.commitmentCount.toString() || '0'}</p>
          <p className="text-xs text-purple-600">Commits</p>
        </div>
        <div className="bg-white rounded p-3 text-center">
          <p className="text-xl font-bold text-purple-700">{batchInfo?.settled ? 'Closed' : 'Open'}</p>
          <p className="text-xs text-purple-600">Status</p>
        </div>
        <div className="bg-white rounded p-3 text-center">
          <p className="text-xl font-bold text-purple-700">
            {batchInfo?.clearingPrice ? (Number(batchInfo.clearingPrice) / 2 ** 96).toFixed(4) : '-'}
          </p>
          <p className="text-xs text-purple-600">Price</p>
        </div>
      </div>

      {!batchInfo?.settled ? (
        <button
          onClick={onSettle}
          disabled={loading || !batchInfo?.commitmentCount}
          className="w-full py-2 bg-purple-600 text-white rounded-lg font-medium disabled:opacity-50"
        >
          {loading ? <><Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Settling...</> : 'Settle Batch'}
        </button>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2 bg-green-100 text-green-700 rounded-lg">
          <CheckCircle className="w-5 h-5" />
          Settled
        </div>
      )}

      <div className="mt-4 text-xs text-purple-700">
        <p>1. Users submit ZK swap intents</p>
        <p>2. Commitments batch for 10 blocks</p>
        <p>3. Anyone can settle to execute</p>
      </div>
    </div>
  );
}
