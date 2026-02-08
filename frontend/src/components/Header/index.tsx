import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect } from 'wagmi';
import { useState } from 'react';
import { useLocation, Link, NavLink } from 'react-router-dom';
import { 
  Wallet, 
  ExternalLink, 
  Menu, 
  X, 
  BookOpen, 
  ArrowLeftRight, 
  Droplets, 
  Github,
  History,
  Blend, // Mixing/pooling concept
  EyeOff, // Privacy concept - alternative option
  ShieldCheck, // Security concept - alternative option
  Sparkles // Magic/premium feel - alternative option
} from 'lucide-react';

export default function Header() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  
  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/' || location.pathname === '/swap';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/', label: 'Swap', icon: ArrowLeftRight },
    { path: '/liquidity', label: 'Pool', icon: Droplets },
    { path: '/history', label: 'History', icon: History },
    { path: '/docs', label: 'Docs', icon: BookOpen },
  ];

  return (
    <header className="fixed inset-x-0 top-0 h-16 bg-white/60 backdrop-blur-md border-b border-gray-100 z-50">
      <div className="h-full flex items-center justify-between px-3 sm:px-4 max-w-7xl mx-auto">
        {/* Logo - Cool icon + text design */}
        <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all group shrink-0">
          {/* Icon Container - Animated gradient */}
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-pink-400 via-rose-500 to-purple-600 flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:shadow-pink-500/30 group-hover:scale-105 transition-all duration-300">
            {/* Option 1: Blend (Mixing/Pooling) - Best for Dark Pool DEX */}
            <Blend className="w-5 h-5 sm:w-6 sm:h-6 text-white transform rotate-180" />
            
            {/* Option 2: EyeOff (Privacy/Hidden) - Uncomment to use instead */}
            {/* <EyeOff className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> */}
            
            {/* Option 3: ShieldCheck (Security/Trust) - Uncomment to use instead */}
            {/* <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> */}
            
            {/* Option 4: Sparkles (Magic/Exclusive) - Uncomment to use instead */}
            {/* <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-white" /> */}
            
            {/* Subtle glow effect */}
            <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </div>
          
          {/* Text Logo */}
          <div className="flex flex-col min-w-0">
            <span className="text-gray-900 font-bold text-lg sm:text-xl leading-tight tracking-tight">
              Privy<span className="text-pink-500">Flow</span>
            </span>
            <span className="text-gray-400 text-[10px] sm:text-xs font-medium hidden sm:block tracking-wide uppercase">
              Dark Pool DEX
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-1 bg-gray-100/80 rounded-2xl p-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                    isActive
                      ? 'text-gray-900 font-semibold bg-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-800 font-medium hover:bg-white/50'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-pink-500' : ''}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
          {/* GitHub Link - Desktop */}
          <a
            href="https://github.com/0xfdbu/hackmoney2026"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-gray-500 hover:text-gray-800 font-medium hover:bg-white/50 transition-all"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
        </nav>
        
        {/* Mobile Menu Button */}
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
        >
          {mobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
        </button>

        {/* Desktop Wallet Connect Button */}
        <div className="hidden md:block">
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
      
      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white border-b border-gray-100 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto">
          <nav className="flex flex-col p-4 gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                    active
                      ? 'text-gray-900 font-semibold bg-pink-50 border border-pink-100'
                      : 'text-gray-600 font-medium hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    active ? 'bg-pink-100' : 'bg-gray-100'
                  }`}>
                    <Icon className={`w-5 h-5 ${active ? 'text-pink-500' : 'text-gray-500'}`} />
                  </div>
                  {item.label}
                </Link>
              );
            })}
            
            {/* GitHub Link - Mobile */}
            <a
              href="https://github.com/0xfdbu/hackmoney2026"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 font-medium hover:bg-gray-50 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                <Github className="w-5 h-5 text-gray-500" />
              </div>
              GitHub
            </a>
            
            {/* Mobile Wallet Button */}
            <div className="border-t border-gray-100 pt-4 mt-2">
              {isConnected ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl flex-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse shrink-0"></span>
                    <span className="font-medium text-gray-800 truncate">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      disconnect();
                      setMobileMenuOpen(false);
                    }}
                    className="p-3 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors shrink-0"
                  >
                    <ExternalLink className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => {
                    open();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-3 rounded-xl font-semibold"
                >
                  <Wallet className="w-4 h-4" />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}