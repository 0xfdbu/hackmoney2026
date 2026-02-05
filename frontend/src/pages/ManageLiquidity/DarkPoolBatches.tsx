import React from 'react';
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface DarkPoolBatchesProps {
  currentBatchId?: bigint;
  batchInfo?: { commitmentCount: bigint; settled: boolean; clearingPrice: bigint };
  onSettle: () => void;
  loading?: boolean;
}

export function DarkPoolBatches({ currentBatchId, batchInfo, onSettle, loading }: DarkPoolBatchesProps) {
  // Safe conversion helpers
  const batchIdStr = currentBatchId?.toString() || '...';
  const commitCount = batchInfo?.commitmentCount?.toString() || '0';
  const isSettled = batchInfo?.settled || false;
  const clearingPrice = batchInfo?.clearingPrice 
    ? (Number(batchInfo.clearingPrice) / 2 ** 96).toFixed(4) 
    : '-';

  return (
    <div className="bg-purple-50 rounded-xl border-2 border-purple-200 p-4">
      <h3 className="font-semibold text-purple-900 flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5" />
        DarkPool Batches
      </h3>

      {!currentBatchId ? (
        <div className="text-center py-8 text-purple-700">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-purple-400" />
          <p>Loading batch data...</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg p-3 mb-4">
            <p className="text-xs text-purple-600 uppercase">Current Batch</p>
            <p className="text-2xl font-bold text-purple-700">#{batchIdStr}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xl font-bold text-purple-700">{commitCount}</p>
              <p className="text-xs text-purple-600">Commits</p>
            </div>
            <div className="bg-white rounded p-3 text-center">
              <p className={`text-xl font-bold ${isSettled ? 'text-green-600' : 'text-blue-600'}`}>
                {isSettled ? 'Closed' : 'Open'}
              </p>
              <p className="text-xs text-purple-600">Status</p>
            </div>
            <div className="bg-white rounded p-3 text-center">
              <p className="text-xl font-bold text-purple-700">{clearingPrice}</p>
              <p className="text-xs text-purple-600">Price</p>
            </div>
          </div>

          {!isSettled ? (
            <button
              onClick={onSettle}
              disabled={loading || !batchInfo?.commitmentCount}
              className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg font-medium"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 inline animate-spin mr-2" /> Settling...</>
              ) : (
                'Settle Batch'
              )}
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 py-2 bg-green-100 text-green-700 rounded-lg">
              <CheckCircle className="w-5 h-5" />
              Batch Settled
            </div>
          )}
        </>
      )}

      <div className="mt-4 text-xs text-purple-700 space-y-1">
        <p>1. Users submit ZK swap intents</p>
        <p>2. Commitments batch for 10 blocks</p>
        <p>3. Anyone can settle to execute</p>
      </div>
    </div>
  );
}
