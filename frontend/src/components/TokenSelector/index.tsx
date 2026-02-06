import { X } from 'lucide-react';

interface TokenSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: 'ETH' | 'USDC' | 'WETH') => void;
  excludeToken?: string;
}

// Available tokens - ETH is actually WETH under the hood for the pool
const TOKEN_INFO: Record<string, { symbol: string; name: string; icon: string; displayAs?: string }> = {
  ETH: {
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  },
  WETH: {
    symbol: 'ETH',  // Display as ETH
    name: 'Ethereum (Wrapped)',
    icon: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
    displayAs: 'ETH',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    icon: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
  },
};

export default function TokenSelector({ isOpen, onClose, onSelect, excludeToken }: TokenSelectorProps) {
  if (!isOpen) return null;

  // Filter out excluded token and don't show ETH and WETH at the same time
  // If ETH is selected, don't show WETH and vice versa
  const tokens = Object.entries(TOKEN_INFO).filter(([key]) => {
    if (key === excludeToken) return false;
    // If ETH is excluded, also exclude WETH
    if (excludeToken === 'ETH' && key === 'WETH') return false;
    if (excludeToken === 'WETH' && key === 'ETH') return false;
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-gray-100">
          <h3 className="text-xl font-bold text-gray-800">Select Token</h3>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-2 max-h-80 overflow-y-auto">
          {tokens.map(([key, token]) => (
            <button
              key={key}
              onClick={() => {
                onSelect(key as 'ETH' | 'USDC' | 'WETH');
                onClose();
              }}
              className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 rounded-2xl transition-colors"
            >
              <img 
                src={token.icon} 
                alt={token.symbol}
                className="w-10 h-10 rounded-full"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <div className="text-left flex-1">
                <div className="font-bold text-gray-800">{token.displayAs || token.symbol}</div>
                <div className="text-sm text-gray-500">{token.name}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
