# PrivyFlow 🔒 - Privacy-Preserving DEX on Uniswap v4

**Winner of Uniswap v4 Privacy Track** 🏆

PrivyFlow is a dark pool DEX built on Uniswap v4 hooks that enables privacy-preserving swaps using a commit-reveal scheme. Users commit to trades without revealing amounts, then execute after a 10-block delay to prevent MEV and front-running.

## 🎯 Problem Statement

**MEV attacks and front-running** cost DeFi users millions annually. When you submit a swap on a public blockchain:
- Bots see your transaction in the mempool
- They front-run you to extract value
- You get worse prices than expected

**Solution**: Hide the trade details until execution time using cryptographic commitments.

## 🔧 How It Works

### Commit-Reveal Flow

```
┌─────────────┐     Commit Phase      ┌─────────────┐
│   User      │ ─────────────────────>│ CommitStore │
│             │  commitment =         │  Contract   │
│  amount=?   │  keccak256(amount,    │             │
│  salt=secret│  minOut, salt)        │  Stores hash│
└─────────────┘                       └─────────────┘
                                              │
                                              │ 10 blocks
                                              ▼
┌─────────────┐     Reveal Phase      ┌─────────────┐
│   User      │ ─────────────────────>│  DarkPool   │
│             │  Reveal: amount,      │    Hook     │
│  reveals    │  minOut, salt         │             │
│  secret     │                       │  Verifies & │
└─────────────┘                       │  executes   │
                                      └─────────────┘
```

### Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │  Swap UI    │  │ Salt Gen    │  │ 10-Block Timer  │ │
│  └─────────────┘  └─────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Smart Contracts                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ CommitStore  │  │ DarkPoolHook │  │ SwapRouter   │ │
│  │              │  │              │  │              │ │
│  │ - Store hash │  │ - Verify     │  │ - Execute    │ │
│  │ - 10-block   │  │ - Reveal     │  │ - Settle     │ │
│  │   delay      │  │ - Call swap  │  │   deltas     │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                  Uniswap v4 Pool                        │
│              USDC/WETH 0.3% + Hook                      │
└─────────────────────────────────────────────────────────┘
```

## 📋 Smart Contracts

### CommitStore.sol
Stores commitments and enforces the privacy delay.

```solidity
function commit(bytes32 commitmentHash, bytes32 nullifier) external;
function canReveal(bytes32 commitment, uint256 amount, uint256 minOut, uint256 salt) 
    external view returns (bool);
```

### DarkPoolHook.sol
Uniswap v4 hook that verifies commitments before allowing swaps.

```solidity
function beforeSwap(address, PoolKey calldata key, SwapParams calldata params, bytes calldata hookData) 
    external returns (bytes4, BeforeSwapDelta, uint24);
```

### SwapRouter.sol
Handles the unlock/settlement pattern for Uniswap v4.

```solidity
function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData) 
    external payable returns (BalanceDelta);
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Foundry
- Sepolia ETH

### Installation

```bash
# Clone repo
git clone https://github.com/yourname/privyflow.git
cd privyflow

# Install dependencies
cd contracts && forge install
cd ../frontend && npm install
```

### Deploy Contracts

```bash
cd contracts
source .env  # Set PRIVATE_KEY and SEPOLIA_RPC_URL

# Deploy all contracts
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Initialize pool
forge script script/InitPool.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Add liquidity
forge script script/AddLiquidity.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

### Run Frontend

```bash
cd frontend
npm run dev
```

## 📱 Usage Guide

### 1. Commit Phase
- Enter swap amount (e.g., 10 USDC → ETH)
- Set slippage tolerance (recommend 100% for testing)
- Click **"Commit Swap"**
- **SAVE YOUR SALT!** This is required for reveal

### 2. Wait 10 Blocks
- Visual countdown shows remaining blocks
- ~2 minutes on Sepolia
- Go grab a coffee ☕

### 3. Reveal Phase
- Click **"Reveal Swap"**
- Hook verifies your commitment
- Swap executes through Uniswap v4
- Receive ETH!

## 🔑 Key Features

### Privacy by Design
- Trade amounts hidden until execution
- Commitment hashes stored on-chain
- Reveal only after delay

### MEV Protection
- 10-block delay prevents sandwich attacks
- Commitments can't be frontrun
- No mempool leakage of trade details

### Uniswap v4 Integration
- Native hook support
- Uses v4's unlock/settlement pattern
- Compatible with existing liquidity

## 🧪 Testing

### Local Testing
```bash
# Start Anvil
anvil --fork-url $SEPOLIA_RPC_URL

# Run tests
forge test
```

### Sepolia Testnet
Contract Addresses:
| Contract | Address |
|----------|---------|
| CommitStore | `0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C` |
| DarkPoolHook | `0x1846217Bae61BF26612BD8d9a64b970d525B4080` |
| SwapRouter | `0x36b42E07273CD8ECfF1125bF15771AE356F085B1` |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |

## 🔒 Security Considerations

- **Salt Storage**: User must save their salt - lost salt = lost funds
- **Timing**: 10-block delay provides privacy but adds latency
- **Price Impact**: Use high slippage (100%) for skewed pools

## 🛠️ Tech Stack

- **Smart Contracts**: Solidity 0.8.26, Foundry
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Web3**: Wagmi, Viem, Reown AppKit
- **DEX**: Uniswap v4

## 📝 License

MIT License - see LICENSE file

## 🙏 Acknowledgments

- Uniswap Labs for v4 hooks
- Foundry team for testing framework
- Ethereum community for continuous innovation

---

**Built with ❤️ for Uniswap v4 Hookathon 2026**
