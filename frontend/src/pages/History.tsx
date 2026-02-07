import { useState, useEffect } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import {
  History as HistoryIcon,
  ArrowUpRight,
  ArrowDownLeft,
  ExternalLink,
  AlertCircle,
  Loader2,
  Wallet,
  Coins,
  Filter
} from 'lucide-react';

interface TokenTransfer {
  hash: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: number;
  timestamp: string;
  gasPrice: string;
  isSmall: boolean;
}

interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timestamp: string;
  gasPrice: string;
  isError: string;
}

const BLOCKSCOUT_API_BASE = 'https://eth-sepolia.blockscout.com/api';
const EXPLORER_BASE = 'https://eth-sepolia.blockscout.com';

export default function History() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'transfers' | 'transactions'>('transfers');
  const [transfers, setTransfers] = useState<TokenTransfer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSmallOnly, setShowSmallOnly] = useState(false);

  // Fetch token transfers from Blockscout (Etherscan-compatible, public, no key required)
  const fetchTokenTransfers = async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const allTransfersRes = await fetch(
        `${BLOCKSCOUT_API_BASE}?module=account&action=tokentx&address=${address}&sort=desc`
      );
      const allTransfers = await allTransfersRes.json();

      if (allTransfers.status === '1' && allTransfers.result?.length > 0) {
        const processedTransfers: TokenTransfer[] = allTransfers.result.map((tx: any) => {
          const decimal = parseInt(tx.tokenDecimal);
          const rawValue = BigInt(tx.value || '0');
          const valueNum = Number(rawValue / (10n ** BigInt(decimal)));
          const value = valueNum.toFixed(6);
          const isSmall = valueNum < 0.001;

          return {
            hash: tx.hash,
            from: tx.from,
            to: tx.to,
            value,
            tokenSymbol: tx.tokenSymbol || 'Unknown',
            tokenDecimal: decimal,
            timestamp: new Date(parseInt(tx.timeStamp) * 1000).toLocaleString(),
            gasPrice: tx.gasPrice,
            isSmall
          };
        });
        setTransfers(processedTransfers);
      } else {
        setTransfers([]);
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
      setError('Failed to fetch token transfers. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch normal transactions from Blockscout
  const fetchTransactions = async () => {
    if (!address) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `${BLOCKSCOUT_API_BASE}?module=account&action=txlist&address=${address}&sort=desc`
      );
      const data = await response.json();

      if (data.status === '1' && data.result?.length > 0) {
        const processedTxs: Transaction[] = data.result.slice(0, 50).map((tx: any) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to || '',
          value: (Number(BigInt(tx.value)) / 1e18).toFixed(6),
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toLocaleString(),
          gasPrice: tx.gasPrice,
          isError: tx.isError
        }));
        setTransactions(processedTxs);
      } else {
        setTransactions([]);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setError('Failed to fetch transactions. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      if (activeTab === 'transfers') {
        fetchTokenTransfers();
      } else {
        fetchTransactions();
      }
    }
  }, [address, isConnected, activeTab]);

  const isOutgoing = (tx: TokenTransfer | Transaction) => {
    return tx.from.toLowerCase() === address?.toLowerCase();
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const filteredTransfers = showSmallOnly
    ? transfers.filter(t => t.isSmall)
    : transfers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full text-purple-700 text-sm font-medium mb-4">
            <HistoryIcon className="w-4 h-4" />
            <span>Transaction History</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            History
          </h1>
          <p className="text-gray-600">
            View your recent token transfers and transactions on Sepolia
          </p>
        </div>

        {!isConnected ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-12 text-center">
            <Wallet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Connect Wallet</h3>
            <p className="text-gray-500">Connect your wallet to view transaction history</p>
          </div>
        ) : (
          <>
            {/* Wallet Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Connected Wallet</p>
                  <p className="font-mono text-lg font-semibold text-gray-900">{address}</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden mb-6">
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab('transfers')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'transfers'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  Token Transfers
                  {transfers.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                      {transfers.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('transactions')}
                  className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === 'transactions'
                      ? 'bg-purple-50 text-purple-700 border-b-2 border-purple-500'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <HistoryIcon className="w-4 h-4" />
                  All Transactions
                </button>
              </div>

              {/* Filter Bar */}
              {activeTab === 'transfers' && (
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSmallOnly}
                      onChange={(e) => setShowSmallOnly(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      <Filter className="w-4 h-4" />
                      Show only small amounts (&lt; 0.001)
                    </span>
                  </label>
                </div>
              )}

              <div className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                    <p className="text-gray-500">Loading history...</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                    <p className="text-red-600 text-center">{error}</p>
                    <button
                      onClick={() => activeTab === 'transfers' ? fetchTokenTransfers() : fetchTransactions()}
                      className="mt-4 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                    >
                      Retry
                    </button>
                  </div>
                ) : activeTab === 'transfers' ? (
                  <div className="space-y-3">
                    {filteredTransfers.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Coins className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p>No token transfers found</p>
                        {showSmallOnly && (
                          <p className="text-sm mt-2">Try turning off the "small amounts" filter</p>
                        )}
                      </div>
                    ) : (
                      filteredTransfers.map((transfer, index) => (
                        <div
                          key={`${transfer.hash}-${index}`}
                          className={`rounded-xl p-4 border transition-all hover:shadow-md ${
                            transfer.isSmall
                              ? 'bg-amber-50 border-amber-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isOutgoing(transfer)
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                {isOutgoing(transfer) ? (
                                  <ArrowUpRight className="w-5 h-5" />
                                ) : (
                                  <ArrowDownLeft className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-gray-900">
                                    {isOutgoing(transfer) ? 'Sent' : 'Received'}
                                  </span>
                                  {transfer.isSmall && (
                                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 text-xs rounded-full font-medium">
                                      Small
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-gray-500">
                                  {isOutgoing(transfer)
                                    ? `To: ${formatAddress(transfer.to)}`
                                    : `From: ${formatAddress(transfer.from)}`
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${
                                isOutgoing(transfer) ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {isOutgoing(transfer) ? '-' : '+'}{transfer.value} {transfer.tokenSymbol}
                              </p>
                              <p className="text-xs text-gray-400">{transfer.timestamp}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-end">
                            <a
                              href={`${EXPLORER_BASE}/tx/${transfer.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                            >
                              View on Blockscout
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <HistoryIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p>No transactions found</p>
                      </div>
                    ) : (
                      transactions.map((tx, index) => (
                        <div
                          key={`${tx.hash}-${index}`}
                          className="bg-gray-50 rounded-xl p-4 border border-gray-200 hover:shadow-md transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                isOutgoing(tx)
                                  ? 'bg-red-100 text-red-600'
                                  : 'bg-green-100 text-green-600'
                              }`}>
                                {isOutgoing(tx) ? (
                                  <ArrowUpRight className="w-5 h-5" />
                                ) : (
                                  <ArrowDownLeft className="w-5 h-5" />
                                )}
                              </div>
                              <div>
                                <span className="font-semibold text-gray-900">
                                  {isOutgoing(tx) ? 'Sent ETH' : 'Received ETH'}
                                </span>
                                <p className="text-sm text-gray-500">
                                  {isOutgoing(tx)
                                    ? `To: ${formatAddress(tx.to)}`
                                    : `From: ${formatAddress(tx.from)}`
                                  }
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`font-semibold ${
                                isOutgoing(tx) ? 'text-red-600' : 'text-green-600'
                              }`}>
                                {isOutgoing(tx) ? '-' : '+'}{tx.value} ETH
                              </p>
                              <p className="text-xs text-gray-400">{tx.timestamp}</p>
                            </div>
                          </div>
                          {tx.isError === '1' && (
                            <div className="mt-2 px-3 py-1 bg-red-100 text-red-700 text-xs rounded-lg inline-block">
                              Failed
                            </div>
                          )}
                          <div className="mt-3 pt-3 border-t border-gray-200/50 flex justify-end">
                            <a
                              href={`${EXPLORER_BASE}/tx/${tx.hash}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-purple-600 hover:text-purple-700"
                            >
                              View on Blockscout
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Legend */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Legend</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <span className="text-gray-600">Incoming</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">Outgoing</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                  <span className="text-gray-600">Small Amount</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  <span className="text-gray-600">Failed Tx</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}