import { useAccount, useBalance } from 'wagmi';
import { Wallet, TrendingUp, Clock } from 'lucide-react';
import { TOKENS } from '../contracts/constants';

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const { data: usdcBalance } = useBalance({ 
    address, 
    token: TOKENS.USDC.address as `0x${string}` 
  });

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 px-4">
        <div className="max-w-2xl mx-auto text-center py-20">
          <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center">
            <Wallet className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">Connect Your Wallet</h1>
          <p className="text-gray-500 mb-8">Connect your wallet to view your portfolio and positions</p>
          <button className="px-8 py-4 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-2xl font-bold shadow-lg shadow-pink-500/25">
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  const ethValue = ethBalance ? parseFloat(ethBalance.formatted) * 2000 : 0;
  const usdcValue = usdcBalance ? parseFloat(usdcBalance.formatted) : 0;
  const totalValue = ethValue + usdcValue;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">Portfolio</h1>
        <p className="text-gray-500 mb-8">Track your assets and positions</p>

        {/* Total Value */}
        <div className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100 mb-6">
          <div className="text-gray-500 mb-2">Total Balance</div>
          <div className="text-5xl font-bold text-gray-800 mb-4">
            ${totalValue.toFixed(2)}
          </div>
          <div className="flex items-center gap-2 text-green-500">
            <TrendingUp className="w-4 h-4" />
            <span className="font-medium">+0.0% this week</span>
          </div>
        </div>

        {/* Token Balances */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Your Assets</h2>
        <div className="space-y-3 mb-8">
          {/* ETH */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://cryptologos.cc/logos/ethereum-eth-logo.png" 
                alt="ETH"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="font-bold text-gray-800">Ethereum</div>
                <div className="text-gray-500">ETH</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">
                {ethBalance ? parseFloat(ethBalance.formatted).toFixed(4) : '--'} ETH
              </div>
              <div className="text-gray-500">${ethValue.toFixed(2)}</div>
            </div>
          </div>

          {/* USDC */}
          <div className="bg-white rounded-2xl p-5 shadow-lg border border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="https://cryptologos.cc/logos/usd-coin-usdc-logo.png" 
                alt="USDC"
                className="w-12 h-12 rounded-full"
              />
              <div>
                <div className="font-bold text-gray-800">USD Coin</div>
                <div className="text-gray-500">USDC</div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-gray-800">
                {usdcBalance ? parseFloat(usdcBalance.formatted).toFixed(2) : '--'} USDC
              </div>
              <div className="text-gray-500">${usdcValue.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <h2 className="text-xl font-bold text-gray-800 mb-4">Recent Activity</h2>
        <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Clock className="w-5 h-5 mr-2" />
            <span>No recent activity</span>
          </div>
        </div>
      </div>
    </div>
  );
}
