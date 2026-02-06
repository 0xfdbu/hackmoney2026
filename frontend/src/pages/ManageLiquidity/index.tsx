import { useAccount, useReadContract } from 'wagmi';
import { Droplets, TrendingUp, Waves } from 'lucide-react';
import { HOOK_ADDRESS } from '../../contracts/constants';

export default function ManageLiquidity() {
  const { address, isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Pool</h1>
        <p className="text-gray-500 mb-8">Provide liquidity to earn fees on trades</p>

        {/* Pool Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
                <Waves className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-500 font-medium">Total Liquidity</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">$12,450</div>
            <div className="text-sm text-green-500 mt-1">+2.4% this week</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-500 font-medium">24h Volume</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">$3,280</div>
            <div className="text-sm text-gray-400 mt-1">Across all pools</div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-500 font-medium">Your Positions</span>
            </div>
            <div className="text-2xl font-bold text-gray-800">--</div>
            <div className="text-sm text-gray-400 mt-1">Connect wallet to view</div>
          </div>
        </div>

        {/* Active Pool */}
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-gray-100 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-800 mb-1">ETH/USDC Pool</h2>
              <p className="text-gray-500 text-sm">0.3% fee tier • Dark Pool Hook</p>
            </div>
            <div className="px-4 py-2 bg-gradient-to-r from-pink-50 to-rose-50 text-pink-600 rounded-xl font-semibold text-sm border border-pink-100">
              Active
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-gray-500 text-sm mb-1">ETH Locked</div>
              <div className="text-xl font-bold text-gray-800">0.00001</div>
              <div className="text-sm text-gray-400">~$20.00</div>
            </div>
            <div className="bg-gray-50 rounded-2xl p-4">
              <div className="text-gray-500 text-sm mb-1">USDC Locked</div>
              <div className="text-xl font-bold text-gray-800">0.01</div>
              <div className="text-sm text-gray-400">~$20.00</div>
            </div>
          </div>

          <button 
            disabled={!isConnected}
            className="w-full py-4 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:from-gray-200 disabled:to-gray-200 disabled:text-gray-400 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-pink-500/25"
          >
            {isConnected ? 'Add Liquidity' : 'Connect Wallet'}
          </button>
        </div>

        {/* How it works */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-100">
          <h3 className="text-gray-800 font-bold mb-4 flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-sm">💡</span>
            Liquidity Provider Benefits
          </h3>
          <div className="space-y-3 text-gray-600">
            <p>• Earn 0.3% fee on all trades through the pool</p>
            <p>• Support private trading with MEV protection</p>
            <p>• No impermanent loss from front-running bots</p>
          </div>
        </div>
      </div>
    </div>
  );
}
