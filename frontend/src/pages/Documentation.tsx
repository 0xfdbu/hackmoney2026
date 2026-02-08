import { useState } from 'react';
import { 
  BookOpen, 
  Code2, 
  Shield, 
  Clock, 
  Key, 
  ArrowRight,
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
            <div className="text-xs text-white/70">0xdC81...116C</div>
          </div>
          
          <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl p-5 text-white text-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <Layers className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm">DarkPoolHook</div>
            <div className="text-xs text-white/70">0x7785...C54</div>
          </div>
          
          <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white text-center">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-2">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="font-bold text-sm">SwapRouter</div>
            <div className="text-xs text-white/70">0xB276...90Ba</div>
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
            <div className="text-sm text-white/70">ETH/USDC Pool (0.05%)</div>
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
        "User enters swap amount (e.g., 10 USDC)",
        "Frontend generates random salt",
        "Computes keccak256(amount, minOut, salt)",
        "Submits commitment hash to CommitStore",
        "Waits 10 blocks (~2 min)"
      ]
    },
    {
      phase: "REVEAL",
      icon: Key,
      color: "from-purple-500 to-indigo-500",
      steps: [
        "After 10-block delay",
        "User approves USDC spend (if needed)",
        "Reveals salt + commitment to DarkPoolHook",
        "Hook verifies commitment is valid",
        "Hook marks commitment as revealed"
      ]
    },
    {
      phase: "EXECUTE",
      icon: CheckCircle,
      color: "from-green-500 to-emerald-500",
      steps: [
        "Uniswap v4 PoolManager executes swap",
        "USDC transferred from user to pool",
        "ETH transferred from pool to user",
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
    { name: "DarkPoolHook", address: "0x77853497C9dEC9460fb305cbcD80C7DAF4EcDC54", description: "Uniswap v4 hook with BEFORE_SWAP flag (0x04)" },
    { name: "SwapRouter", address: "0xB276FA545ed8848EC49b2a925c970313253B90Ba", description: "Handles swap routing and settlement (fixed delta logic)" },
    { name: "PoolManager", address: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543", description: "Uniswap v4 PoolManager (Sepolia)" },
    { name: "USDC", address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", description: "Test USDC token (6 decimals)" },
    { name: "WETH", address: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14", description: "Wrapped ETH (for wrapping only)" },
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
                
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
                  <p className="text-blue-800 text-sm font-medium mb-2">
                    ✨ Live on Sepolia Testnet
                  </p>
                  <p className="text-blue-700 text-sm">
                    Successfully tested with 10 USDC → 0.0047 ETH swap using commit-reveal privacy.
                  </p>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4">Key Features</h3>
                <div className="grid md:grid-cols-2 gap-6 not-prose">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center shrink-0">
                      <EyeOff className="w-6 h-6 text-pink-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Hidden Amounts</div>
                      <div className="text-gray-600">Your trade size is encrypted using cryptographic commitments (keccak256)</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">MEV Protection</div>
                      <div className="text-gray-600">10-block delay prevents sandwich attacks and frontrunning</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                      <Lock className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Trustless</div>
                      <div className="text-gray-600">Fully decentralized, no custody of funds. Self-custody only.</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">Time-Locked</div>
                      <div className="text-gray-600">Commitments require a 10-block delay before reveal</div>
                    </div>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-900 mt-8 mb-4">Technology Stack</h3>
                <ul className="space-y-2">
                  <li><strong>Smart Contracts:</strong> Solidity 0.8.26, Foundry, Uniswap v4</li>
                  <li><strong>Pool:</strong> ETH/USDC with 0.05% fee tier (tick spacing 10)</li>
                  <li><strong>Frontend:</strong> React 18, TypeScript, Vite, Tailwind CSS</li>
                  <li><strong>Wallet Integration:</strong> Reown AppKit, Wagmi, Viem</li>
                  <li><strong>Network:</strong> Ethereum Sepolia Testnet (Chain ID: 11155111)</li>
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
                    Address: <code className="text-xs bg-gray-200 px-1 rounded">0xdC81...116C</code>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">DarkPoolHook.sol</h3>
                  <p className="text-gray-600 text-sm">
                    Uniswap v4 hook with BEFORE_SWAP flag (0x04) that verifies commitments before swaps. 
                    Deployed to address ending in 0x54 to enable the hook callback.
                    Address: <code className="text-xs bg-gray-200 px-1 rounded">0x7785...C54</code>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">SwapRouter.sol</h3>
                  <p className="text-gray-600 text-sm">
                    Handles the unlock/settlement pattern required by Uniswap v4. Fixed delta logic 
                    (sync → transfer → settle) for proper ERC20 handling.
                    Address: <code className="text-xs bg-gray-200 px-1 rounded">0xB276...90Ba</code>
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="font-bold text-gray-900 mb-3">Frontend</h3>
                  <p className="text-gray-600 text-sm">
                    React app that generates salts client-side, computes commitments using keccak256, 
                    and manages the commit-reveal flow with localStorage persistence.
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
                <p className="text-yellow-800 mb-2">
                  The salt is generated client-side and never stored on-chain. If you lose it, 
                  you cannot reveal your commitment and your funds will be locked.
                </p>
                <p className="text-yellow-700 text-sm">
                  The salt is a large random number (e.g., <code>52555232</code>) used to compute 
                  the commitment hash: <code>keccak256(amount, minOut, salt)</code>
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
                <p className="text-blue-700 text-sm mt-1">
                  <strong>Pool:</strong> ETH/USDC with 0.05% fee (500 basis points), tick spacing 10
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
                    Successful Live Swap: USDC → ETH
                  </h3>
                  <TxCard 
                    title="Dark Pool Swap Execution"
                    txHash="0xce5347734c3aae046cec3b6a464e1a16698ff7e65f8265bebf61e2417f4859c9"
                    description="10 USDC → 0.004745 ETH via DarkPoolHook with commit-reveal. Block 10213675."
                    status="success"
                  />
                  
                  <div className="mt-4 bg-gray-50 rounded-2xl p-6 font-mono text-sm">
                    <div className="grid grid-cols-2 gap-4 text-gray-700">
                      <div>
                        <span className="text-gray-500">Input:</span> 10 USDC
                      </div>
                      <div>
                        <span className="text-gray-500">Output:</span> 0.004745 ETH
                      </div>
                      <div>
                        <span className="text-gray-500">Rate:</span> ~2,107 USDC/ETH
                      </div>
                      <div>
                        <span className="text-gray-500">Pool Fee:</span> 0.05%
                      </div>
                      <div>
                        <span className="text-gray-500">Commit Block:</span> 10213665
                      </div>
                      <div>
                        <span className="text-gray-500">Reveal Block:</span> 10213675
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">Example Commitment Parameters</h3>
                  <div className="bg-gray-900 rounded-2xl p-6 text-white font-mono text-sm overflow-x-auto">
                    <div className="mb-2 text-gray-400">// Successful Test Parameters</div>
                    <div>amount: 10000000 <span className="text-gray-500">// 10 USDC (6 decimals)</span></div>
                    <div>minOut: 4000000000000000 <span className="text-gray-500">// 0.004 ETH (18 decimals)</span></div>
                    <div>salt: 52555232 <span className="text-gray-500">// Random uint256</span></div>
                    <div className="mt-2 text-green-400 break-all">
                      commitment: 0xa4156ce6679fbcc43833e220d1183c652030cd662021f99664e85ba03985a70c
                    </div>
                    <div className="mt-1 text-blue-400 break-all">
                      nullifier: 0x4d72cc3ee2c0431cdeab5f4b7ec191f428cd6cb01b216daa37a419684638737a
                    </div>
                    <div className="mt-2 text-gray-500">// Pool: ETH(0)/USDC(1), zeroForOne: false</div>
                  </div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-2xl p-6 mt-6">
                  <h3 className="font-bold text-green-900 mb-2">Contract Verification</h3>
                  <ul className="space-y-2 text-sm text-green-800">
                    <li>✓ CommitStore deployed and verified</li>
                    <li>✓ DarkPoolHook deployed with BEFORE_SWAP flag (0x04)</li>
                    <li>✓ SwapRouter deployed with fixed settlement logic</li>
                    <li>✓ Pool initialized: ETH/USDC 0.05% fee, tick spacing 10</li>
                    <li>✓ Successfully executed end-to-end swap</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}