import { useState } from 'react';
import { 
  BookOpen, 
  Code2, 
  Shield, 
  Clock, 
  Key, 
  ArrowRight,
  ChevronDown,
  ExternalLink,
  Copy,
  CheckCircle,
  Database,
  Lock,
  EyeOff,
  Layers
} from 'lucide-react';

// Transaction Card Component
function TxCard({ title, txHash, description, status }: { title: string, txHash: string, description: string, status: 'success' | 'pending' | 'failed' }) {
  const [copied, setCopied] = useState(false);
  
  const copyToClipboard = () => {
    navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="font-bold text-gray-900">{title}</h4>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
        </div>
        <div className={`w-3 h-3 rounded-full ${
          status === 'success' ? 'bg-green-500' : 
          status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
        }`} />
      </div>
      <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
        <code className="text-xs text-gray-600 font-mono truncate flex-1">
          {txHash}
        </code>
        <button 
          onClick={copyToClipboard}
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-gray-400" />}
        </button>
        <a 
          href={`https://sepolia.etherscan.io/tx/${txHash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <ExternalLink className="w-4 h-4 text-gray-400" />
        </a>
      </div>
    </div>
  );
}

// Architecture Diagram Component
function ArchitectureDiagram() {
  return (
    <div className="bg-gray-900 rounded-3xl p-8 overflow-x-auto">
      <div className="min-w-[600px]">
        {/* User Layer */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-pink-500 to-purple-600 rounded-2xl p-6 text-white text-center w-48">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Lock className="w-6 h-6" />
            </div>
            <div className="font-bold">User</div>
            <div className="text-sm text-white/70">Wallet Connection</div>
          </div>
        </div>
        
        <div className="flex justify-center mb-8">
          <ArrowRight className="w-6 h-6 text-gray-500 rotate-90" />
        </div>
        
        {/* Frontend Layer */}
        <div className="flex justify-center mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-6 text-white text-center w-64">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Code2 className="w-6 h-6" />
            </div>
            <div className="font-bold">PrivyFlow Frontend</div>
            <div className="text-sm text-white/70">React + Wagmi + Viem</div>
          </div>
        </div>
        
        <div className="flex justify-center mb-8">
          <ArrowRight className="w-6 h-6 text-gray-500 rotate-90" />
        </div>
        
        {/* Smart Contract Layer */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-5 text-white text-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Database className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm">CommitStore</div>
            <div className="text-xs text-white/70">Stores commitments</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-5 text-white text-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm">DarkPoolHook</div>
            <div className="text-xs text-white/70">Uniswap v4 Hook</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white text-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm">SwapRouter</div>
            <div className="text-xs text-white/70">Route & Settle</div>
          </div>
        </div>
        
        <div className="flex justify-center mb-8">
          <ArrowRight className="w-6 h-6 text-gray-500 rotate-90" />
        </div>
        
        {/* Uniswap Layer */}
        <div className="flex justify-center">
          <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-2xl p-6 text-white text-center w-64">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <div className="font-bold">Uniswap v4</div>
            <div className="text-sm text-white/70">PoolManager + Liquidity</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Flow Diagram Component
function FlowDiagram() {
  const steps = [
    {
      phase: "COMMIT",
      icon: Lock,
      color: "from-pink-500 to-rose-500",
      steps: [
        "User enters swap amount",
        "Frontend generates random salt",
        "Computes commitment hash",
        "Submits to CommitStore",
        "Waits 10 blocks (~2 min)"
      ]
    },
    {
      phase: "REVEAL",
      icon: Key,
      color: "from-purple-500 to-indigo-500",
      steps: [
        "After 10-block delay",
        "User approves token spend",
        "Reveals salt + commitment",
        "DarkPoolHook verifies",
        "Hook marks as revealed"
      ]
    },
    {
      phase: "EXECUTE",
      icon: CheckCircle,
      color: "from-green-500 to-emerald-500",
      steps: [
        "Uniswap v4 executes swap",
        "PoolManager updates state",
        "User receives output tokens",
        "Commitment spent forever"
      ]
    }
  ];
  
  return (
    <div className="space-y-6">
      {steps.map((phase, idx) => (
        <div key={idx} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${phase.color} flex items-center justify-center`}>
              <phase.icon className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-sm text-gray-500 font-medium">Phase {idx + 1}</div>
              <div className="text-xl font-bold text-gray-900">{phase.phase}</div>
            </div>
          </div>
          <div className="space-y-2 ml-16">
            {phase.steps.map((step, stepIdx) => (
              <div key={stepIdx} className="flex items-center gap-3 text-gray-600">
                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-medium text-gray-500">
                  {stepIdx + 1}
                </div>
                {step}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Contract Addresses Section
function ContractAddresses() {
  const contracts = [
    { name: "CommitStore", address: "0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C", description: "Stores commitments with 10-block delay" },
    { name: "DarkPoolHook", address: "0x1846217Bae61BF26612BD8d9a64b970d525B4080", description: "Uniswap v4 hook for verification" },
    { name: "SwapRouter", address: "0x36b42E07273CD8ECfF1125bF15771AE356F085B1", description: "Handles swap routing and settlement" },
    { name: "PoolManager", address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543", description: "Uniswap v4 PoolManager (Sepolia)" },
    { name: "USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", description: "Test USDC token" },
    { name: "WETH", address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", description: "Wrapped ETH token" },
  ];
  
  return (
    <div className="grid gap-4">
      {contracts.map((contract, idx) => (
        <div key={idx} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <div className="font-bold text-gray-900">{contract.name}</div>
            <div className="text-sm text-gray-500">{contract.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-xs text-gray-600 font-mono hidden sm:block">{contract.address}</code>
            <a 
              href={`https://sepolia.etherscan.io/address/${contract.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Documentation Page
export default function Documentation() {
  const [activeTab, setActiveTab] = useState('overview');
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: BookOpen },
    { id: 'architecture', label: 'Architecture', icon: Layers },
    { id: 'flow', label: 'Flow', icon: ArrowRight },
    { id: 'contracts', label: 'Contracts', icon: Code2 },
    { id: 'transactions', label: 'Transactions', icon: Database },
  ];
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-blue-50 pt-24 pb-16 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-pink-100 rounded-full text-pink-700 text-sm font-medium mb-4">
            <BookOpen className="w-4 h-4" />
            <span>Technical Documentation</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            How PrivyFlow Works
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            A deep dive into the first privacy-preserving dark pool DEX on Uniswap v4
          </p>
        </div>
        
        {/* Mobile Tab Dropdown */}
        <div className="lg:hidden mb-6">
          <select 
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full p-4 bg-white rounded-xl border border-gray-200 font-medium"
          >
            {tabs.map(tab => (
              <option key={tab.id} value={tab.id}>{tab.label}</option>
            ))}
          </select>
        </div>
        
        {/* Desktop Tabs */}
        <div className="hidden lg:flex justify-center gap-2 mb-8 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Content */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Overview</h2>
              <div className="prose prose-lg max-w-none text-gray-600">
                <p className="mb-4">
                  <strong>PrivyFlow</strong> is a privacy-preserving decentralized exchange (DEX) built on Uniswap v4 hooks. 
                  It uses a <strong>commit-reveal scheme</strong> to hide trade amounts until execution, preventing 
                  MEV bots from frontrunning your trades.
                </p>
                
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4">Key Features</h3>
                <div className="grid md:grid-cols-2 gap-6 not-prose">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                      <EyeOff className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Hidden Amounts</div>
                      <div className="text-gray-600">Your trade size is encrypted using cryptographic commitments</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">MEV Protection</div>
                      <div className="text-gray-600">10-block delay prevents sandwich attacks</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <Lock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Trustless</div>
                      <div className="text-gray-600">Fully decentralized, no custody of funds</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Time-Locked</div>
                      <div className="text-gray-600">Commitments require a delay before reveal</div>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4">Technology Stack</h3>
                <ul className="space-y-2">
                  <li><strong>Smart Contracts:</strong> Solidity 0.8.26, Foundry</li>
                  <li><strong>DEX Infrastructure:</strong> Uniswap v4 (PoolManager, Hooks)</li>
                  <li><strong>Frontend:</strong> React 18, TypeScript, Vite, Tailwind CSS</li>
                  <li><strong>Wallet Integration:</strong> Reown AppKit, Wagmi, Viem</li>
                  <li><strong>Network:</strong> Ethereum Sepolia Testnet</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Architecture Tab */}
          {activeTab === 'architecture' && (
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">System Architecture</h2>
              <ArchitectureDiagram />
              
              <div className="mt-8 grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">CommitStore.sol</h3>
                  <p className="text-gray-600 text-sm">
                    Stores user commitments with a 10-block enforced delay. Prevents double-spending 
                    via nullifier tracking. Only stores commitment hashes, not actual amounts.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">DarkPoolHook.sol</h3>
                  <p className="text-gray-600 text-sm">
                    Uniswap v4 hook that verifies commitments before swaps. Implements beforeSwap 
                    hook to validate reveal parameters against stored commitments.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">SwapRouter.sol</h3>
                  <p className="text-gray-600 text-sm">
                    Handles the unlock/settlement pattern required by Uniswap v4. Manages token 
                    approvals and transfers to the PoolManager.
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">Frontend</h3>
                  <p className="text-gray-600 text-sm">
                    React app that generates salts, computes commitments using keccak256, 
                    and manages the commit-reveal flow with wallet integration.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Flow Tab */}
          {activeTab === 'flow' && (
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Transaction Flow</h2>
              <FlowDiagram />
              
              <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
                <h3 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                  <Key className="w-5 h-5" />
                  Important: Save Your Salt!
                </h3>
                <p className="text-yellow-800">
                  The salt is generated client-side and never stored on-chain. If you lose it, 
                  you cannot reveal your commitment and your funds will be locked. Always copy 
                  and save the salt shown after committing.
                </p>
              </div>
            </div>
          )}
          
          {/* Contracts Tab */}
          {activeTab === 'contracts' && (
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Contract Addresses</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                <p className="text-blue-800 text-sm">
                  <strong>Network:</strong> Ethereum Sepolia Testnet (Chain ID: 11155111)
                </p>
              </div>
              <ContractAddresses />
            </div>
          )}
          
          {/* Transactions Tab */}
          {activeTab === 'transactions' && (
            <div className="p-8 md:p-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Successful Transactions</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    Successful Swap: USDC → WETH
                  </h3>
                  <TxCard 
                    title="Swap Execution"
                    txHash="0xff4614e281d34e2a852b79eac661273aebbcfcdf93d7d897ae30a7289141ce27"
                    description="1 USDC → WETH swap with commit-reveal. Block 10207019 → 10207029"
                    status="success"
                  />
                </div>
                
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-500" />
                    Successful Swap: WETH → USDC
                  </h3>
                  <TxCard 
                    title="Swap Execution"
                    txHash="0x2c7bfdd28112c76c5ed34c3894b9f2d79d5a2bfa96b18f1c1c1e78176ff554c0"
                    description="0.001 WETH → USDC swap with commit-reveal. Foundry script execution."
                    status="success"
                  />
                </div>
                
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Example Commitment</h3>
                  <div className="bg-gray-900 rounded-2xl p-6 text-white font-mono text-sm overflow-x-auto">
                    <div className="mb-2 text-gray-400">// Commitment Parameters</div>
                    <div>amount: 1000000 <span className="text-gray-500">// 1 USDC</span></div>
                    <div>minOut: 0 <span className="text-gray-500">// 100% slippage</span></div>
                    <div>salt: 48208200747286979484880102624422250187739261721973404144477334400866962567443</div>
                    <div className="mt-2 text-green-400">
                      commitment: 0x7d8aa253229cf1f4cdeafb788c184f1ed2a147c28185c55aefe79773e515640c
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
