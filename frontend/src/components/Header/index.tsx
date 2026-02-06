import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect } from 'wagmi';
import { Wallet, ExternalLink } from 'lucide-react';

export default function Header() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <header className="fixed inset-x-0 top-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="h-full flex items-center justify-between px-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center shadow-lg shadow-pink-500/20">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-800 font-bold text-lg leading-tight">PrivyFlow</span>
            <span className="text-gray-400 text-xs font-medium">Dark Pool DEX</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 rounded-2xl p-1">
          <a href="/" className="px-5 py-2 text-gray-800 font-semibold bg-white rounded-xl shadow-sm">
            Swap
          </a>
          <a href="/pool" className="px-5 py-2 text-gray-500 hover:text-gray-800 font-medium hover:bg-white/50 rounded-xl transition-all">
            Pool
          </a>
          <a href="/explore" className="px-5 py-2 text-gray-500 hover:text-gray-800 font-medium hover:bg-white/50 rounded-xl transition-all">
            Explore
          </a>
        </nav>

        {/* Wallet Connect Button */}
        <div>
          {isConnected ? (
            <div className="flex items-center gap-2">
              <button className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-2xl transition-colors font-medium">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span>
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
              </button>
              <button
                onClick={() => disconnect()}
                className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-2xl transition-colors"
                title="Disconnect"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => open()}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-5 py-2.5 rounded-2xl transition-all font-semibold shadow-lg shadow-pink-500/25"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
