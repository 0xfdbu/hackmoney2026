import { TrendingUp, Shield, Clock } from 'lucide-react';

export default function Explore() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Explore PrivyFlow</h1>
        <p className="text-gray-500 mb-8">Privacy-preserving trading on Uniswap v4</p>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="text-3xl font-bold text-gray-800 mb-1">$45.2K</div>
            <div className="text-gray-500">Total Volume</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="text-3xl font-bold text-gray-800 mb-1">127</div>
            <div className="text-gray-500">Total Trades</div>
          </div>
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <div className="text-3xl font-bold text-gray-800 mb-1">10</div>
            <div className="text-gray-500">Block Delay</div>
          </div>
        </div>

        {/* Features */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Why PrivyFlow?</h2>
          
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shrink-0">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">MEV Protection</h3>
                <p className="text-gray-500">Commit-reveal mechanism prevents frontrunning and sandwich attacks by hiding trade amounts until execution.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Time-Delayed Execution</h3>
                <p className="text-gray-500">10-block delay ensures fair execution and prevents last-minute manipulation.</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800 mb-1">Uniswap v4 Integration</h3>
                <p className="text-gray-500">Built as a Uniswap v4 hook, leveraging the most efficient AMM infrastructure.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Hook Address */}
        <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-100">
          <h3 className="text-gray-800 font-bold mb-2">Hook Contract</h3>
          <code className="text-sm text-gray-600 break-all">
            0x30646e72c91705fff997af0FDe5b2f1fbFfB0080
          </code>
          <p className="text-gray-500 text-sm mt-2">Deployed on Sepolia Testnet</p>
        </div>
      </div>
    </div>
  );
}
