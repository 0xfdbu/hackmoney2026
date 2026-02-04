import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect } from 'wagmi';

export default function Header() {
  const { open } = useAppKit(); // Opens the Reown modal
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <header className="fixed inset-x-0 top-0 h-16 bg-white border-b border-gray-200 z-10">
      <div className="h-full flex items-center justify-between px-6">
        {/* Logo / Title */}
        <div className="text-2xl font-bold">
          
        </div>

        {/* Wallet Connect Button – pops Reown modal */}
        <div>
          {isConnected ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={() => disconnect()}
                className="bg-gray-200 text-black px-4 py-2 rounded-lg hover:bg-gray-300 transition text-sm font-medium"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={() => open()} // ← This opens the beautiful Reown modal
              className="bg-black text-white px-6 py-3 rounded-xl hover:bg-gray-800 transition font-medium shadow-md"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}