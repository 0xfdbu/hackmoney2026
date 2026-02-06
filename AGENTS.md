# PrivyFlow - AGENTS.md

## Project Overview

**PrivyFlow** is a privacy-preserving Dark Pool DEX built on Uniswap v4 hooks. It uses a commit-reveal scheme where users hide their trade amounts until execution, with a 10-block delay to prevent MEV and front-running.

### Key Concepts

- **Dark Pool**: A private exchange where orders are hidden until execution
- **Commit-Reveal**: Users commit to a hash of their trade, then reveal later
- **10-Block Delay**: Orders must wait 10 blocks between commit and reveal
- **Uniswap v4 Hook**: Core logic implemented as a hook that verifies commitments

## Technology Stack

### Smart Contracts
- **Framework**: Foundry
- **Solidity Version**: 0.8.26
- **EVM Version**: Cancun
- **Core Dependencies**:
  - Uniswap v4 Core
  - Uniswap v4 Periphery
  - forge-std

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3
- **Wallet Connection**: Reown AppKit + Wagmi
- **Chain Support**: Sepolia testnet

## Project Structure

```
.
├── contracts/                   # Solidity smart contracts
│   ├── src/
│   │   ├── DarkPoolHook.sol    # Main Uniswap v4 hook (commit-reveal verification)
│   │   ├── CommitStore.sol     # Stores commitments with 10-block delay
│   │   └── SwapRouter.sol      # Router for executing swaps with settlement
│   ├── script/
│   │   ├── DeployCommitStore.s.sol   # Deploy CommitStore
│   │   ├── DeployHook.s.sol          # Deploy DarkPoolHook with salt mining
│   │   ├── DeployFullRouter.s.sol    # Deploy SwapRouter
│   │   ├── InitPool.s.sol            # Initialize USDC/WETH pool with hook
│   │   ├── AddLiquidity.s.sol        # Add liquidity to the pool
│   │   └── TestSwap.s.sol            # Test commit-reveal swap flow
│   ├── lib/                    # Foundry dependencies (git submodules)
│   │   ├── forge-std/
│   │   ├── v4-core/
│   │   └── v4-periphery/
│   ├── foundry.toml           # Foundry configuration
│   └── remappings.txt         # Import path remappings
│
└── frontend/                   # React web application
    ├── src/
    │   ├── main.tsx           # App entry + wallet config
    │   ├── pages/
    │   │   └── Swap.tsx       # Dark pool swap interface (commit-reveal)
    │   ├── components/
    │   │   ├── Layout/        # Page layout wrapper
    │   │   ├── Header/        # Navigation header
    │   │   └── TokenSelector/ # Token selection modal
    │   └── contracts/
    │       ├── constants.ts   # Contract addresses
    │       ├── abis.ts        # Contract ABIs
    │       └── routerABI.ts   # SwapRouter ABI
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

## Smart Contracts

### CommitStore.sol

Stores commitments and enforces the 10-block delay.

**Key Features**:
- `BATCH_DELAY = 10` blocks
- Prevents double-spending via nullifiers
- No knowledge of actual amounts (stored as hash only)

**Core Functions**:
- `commit(bytes32 commitmentHash, bytes32 nullifier)`: Store commitment
- `canReveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt)`: Check if ready
- `reveal(...)`: Mark commitment as revealed (called by hook)

### DarkPoolHook.sol

Uniswap v4 hook that verifies commitments before swaps.

**Key Features**:
- `beforeSwap`: Verifies commitment via CommitStore
- Only allows swaps with valid, unrevealed commitments
- 10-block delay enforced

### SwapRouter.sol

Handles the Uniswap v4 unlock/settlement pattern.

**Key Features**:
- `unlock()` pattern for PoolManager interaction
- Automatically settles deltas after swap
- Handles ERC20 transfers to PoolManager

## Deployment Addresses (Sepolia)

| Contract | Address | Notes |
|----------|---------|-------|
| **CommitStore** | `0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C` | Stores commitments |
| **DarkPoolHook** | `0x1846217Bae61BF26612BD8d9a64b970d525B4080` | Verifies on swaps |
| **SwapRouter** | `0x36b42E07273CD8ECfF1125bF15771AE356F085B1` | Executes swaps |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Uniswap v4 |
| USDC | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Test token |
| WETH | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | Wrapped ETH |

### Privacy-Enabled Pool
- **USDC/WETH 0.3% with Hook**: Initialized with hook at `0x1846217Bae61BF26612BD8d9a64b970d525B4080`

## Build Commands

### Smart Contracts

```bash
cd contracts/

# Install dependencies
forge install

# Compile
forge build

# Run tests
forge test
```

### Essential Scripts

```bash
cd contracts/
source .env

# 1. Deploy CommitStore
forge script script/DeployCommitStore.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# 2. Deploy DarkPoolHook (requires salt mining for correct address prefix)
forge script script/DeployHook.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# 3. Deploy SwapRouter
forge script script/DeployFullRouter.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# 4. Initialize pool with hook
forge script script/InitPool.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# 5. Add liquidity
forge script script/AddLiquidity.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# 6. Test swap (commit + reveal)
forge script script/TestSwap.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast
```

### Frontend

```bash
cd frontend/

# Install dependencies
npm install

# Development server
npm run dev

# Build for production
npm run build
```

## Commit-Reveal Flow

### Phase 1: Commit
1. User generates: `commitmentHash = keccak256(amountIn, minAmountOut, salt)`
2. User calls `commitStore.commit(commitmentHash, nullifier)`
3. Commitment stored with current block number
4. Must wait 10 blocks before reveal

### Phase 2: Reveal + Swap
1. After 10+ blocks, user calls `router.swap()` with:
   - PoolKey, SwapParams
   - hookData: `(commitmentHash, salt, minAmountOut)`
2. Hook calls `commitStore.canReveal()` to verify
3. If valid, swap executes through Uniswap v4
4. Commitment marked as revealed

## Frontend Usage

The React frontend supports full commit-reveal flow:

**Features:**
- **Commit Phase**: Generates salt, computes commitment hash, submits to CommitStore
- **10-Block Timer**: Visual progress bar showing remaining blocks
- **Reveal Phase**: After delay, "Reveal Swap" button becomes active
- **Slippage Settings**: 50%, 100% (recommended for testing)
- **Salt Display**: Shows secret salt for user to save

**Usage:**
1. Enter amount and select tokens (USDC → ETH)
2. Set slippage to **100%** in settings (avoids price limit issues)
3. Click "Commit Swap" - saves commitment on-chain
4. Wait 10 blocks (~2 minutes) - watch progress bar  
5. Click "Reveal Swap" - executes the actual trade

## Common Issues

### Price Limit Error
**Problem**: `PriceLimitAlreadyExceeded` - pool price is at extreme

**Solution**: 
- Use **100% slippage** in frontend settings
- This sets `sqrtPriceLimitX96 = 0` (no limit)
- Swap USDC → ETH direction works better

### Hook Not Called
**Problem**: Swap executes but hook doesn't verify

**Solution**:
- Verify pool was initialized WITH the hook address
- Check hook address has correct prefix (salt mining)
- Ensure hook permissions are set correctly

### Commitment Mismatch
**Problem**: `Invalid reveal` - salt/amount doesn't match commitment

**Solution**:
- Save the salt displayed during commit phase
- Use "Fix Salt" option in frontend if reveal fails
- Verify amount and minOut are identical to commit phase

## Environment Setup

Create `contracts/.env`:
```bash
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=0x...
ETHERSCAN_API_KEY=...
```

Create `frontend/.env`:
```bash
VITE_REOWN_PROJECT_ID=your_project_id
```

## Resources

- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Foundry Book](https://book.getfoundry.sh/)
