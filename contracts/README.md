# PrivyFlow - Dark Pool DEX

**Privacy-preserving Uniswap v4 Hook for MEV-resistant trading 🔒**

PrivyFlow is a dark pool DEX built on Uniswap v4 that uses a commit-reveal scheme to hide trade amounts until execution, with a 10-block delay to prevent MEV and front-running attacks.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRIVYFLOW ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────────┘

    User
      │
      ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────────┐
│   Frontend      │────▶│  CommitStore     │     │   Uniswap v4            │
│  (React/Wagmi)  │     │  (Commitments)   │     │   PoolManager           │
└─────────────────┘     └──────────────────┘     └─────────────────────────┘
       │                         │                          ▲
       │                         │                          │
       ▼                         ▼                          │
┌──────────────────────────────────────────────────┐      │
│              DarkPoolHook (Uniswap v4 Hook)       │──────┘
│  ┌─────────────────────────────────────────────┐  │
│  │ • beforeSwap(): Verify commitment           │  │
│  │ • afterSwap():  Clean up state              │  │
│  │ • Commit-reveal logic enforcement           │  │
│  └─────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│  SwapRouter     │
│  (Settlement)   │
└─────────────────┘
```

## Flow Diagram

```
PHASE 1: COMMIT                    PHASE 2: WAIT                    PHASE 3: REVEAL
┌─────────────────┐                ┌─────────────────┐              ┌─────────────────┐
│ 1. User enters  │                │                 │              │ 1. After 10     │
│    swap amount  │                │  10 blocks      │              │    blocks       │
│                 │                │  (~2 minutes)   │              │                 │
│ 2. Generate     │                │                 │              │ 2. Approve      │
│    random salt  │────────────────▶                 │─────────────▶│    tokens       │
│                 │                │ Pool price      │              │                 │
│ 3. Compute      │                │ may change      │              │ 3. Reveal salt  │
│    commitment   │                │                 │              │    + commitment │
│    hash         │                │ MEV bots        │              │                 │
│                 │                │ cannot see      │              │ 4. Hook verifies│
│ 4. Submit to    │                │ amounts!        │              │    & executes   │
│    CommitStore  │                │                 │              │    swap         │
└─────────────────┘                └─────────────────┘              └─────────────────┘
```

## Contract Addresses (Sepolia Testnet)

| Contract | Address | Description |
|----------|---------|-------------|
| **CommitStore** | `0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C` | Stores commitments with 10-block delay |
| **DarkPoolHook** | `0x1846217Bae61BF26612BD8d9a64b970d525B4080` | Uniswap v4 hook for verification |
| **SwapRouter** | ` 0xB276FA545ed8848EC49b2a925c970313253B90Ba` | Handles swap routing and settlement |
| **PoolManager** | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` | Uniswap v4 PoolManager (Sepolia) |
| **USDC** | `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238` | Test USDC token |
| **WETH** | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` | Wrapped ETH token |

## Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
forge install
```

## Environment Setup

Create a `.env` file:

```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0x...  # Your private key (with 0x prefix)
ETHERSCAN_API_KEY=...  # For contract verification (optional)
```

Load the environment:
```bash
source .env
```

---

## Step-by-Step Operations

### 1. Initialize Pool

Before you can add liquidity or swap, you need to initialize the pool with the hook.

**Diagram:**
```
Initialize Pool
     │
     ▼
┌────────────────────────────────────────┐
│  PoolKey:                              │
│  • currency0: USDC                     │
│  • currency1: WETH                     │
│  • fee: 3000 (0.3%)                    │
│  • tickSpacing: 60                     │
│  • hooks: DarkPoolHook                 │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  Initial sqrtPrice: 79228162514...     │
│  (corresponds to initial price ratio)  │
└────────────────────────────────────────┘
```

**Script:**
```bash
forge script script/InitPool.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast \
    -vv
```

**Reference:** [InitPool.s.sol](script/InitPool.s.sol)

**Key Parameters:**
- `currency0`: USDC address
- `currency1`: WETH address  
- `fee`: 3000 (0.3% tier)
- `tickSpacing`: 60 (for 0.3% fee tier)
- `hooks`: DarkPoolHook address
- `sqrtPriceX96`: Initial price (79228162514... for 1:1 approximately)

---

### 2. Add Liquidity

Provide liquidity to the pool so swaps can execute.

**Diagram:**
```
Add Liquidity
     │
     ▼
┌────────────────────────────────────────┐
│  1. Approve tokens for PositionManager │
│     • USDC approval                    │
│     • WETH approval                    │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  2. Mint LP Position                   │
│     • tickLower: -60000                │
│     • tickUpper: 60000                 │
│     • amount0Desired: 1000000 USDC     │
│     • amount1Desired: 1 WETH           │
└────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────┐
│  3. Receive LP NFT/Position            │
└────────────────────────────────────────┘
```

**Script:**
```bash
forge script script/AddLiquidity.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast \
    -vv
```

**Reference:** [AddLiquidity.s.sol](script/AddLiquidity.s.sol)

**Amount Calculation:**
```solidity
// Example: Provide 10 USDC + 0.01 WETH
uint256 usdcAmount = 10 * 10**6;  // USDC has 6 decimals
uint256 wethAmount = 0.01 ether;  // WETH has 18 decimals
```

---

### 3. Execute Swap (Commit-Reveal)

The core PrivyFlow experience - a privacy-preserving swap using commit-reveal.

**Complete Flow Diagram:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMMIT-REVEAL SWAP FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘

PHASE 1: COMMIT (Block N)
┌────────────────────────────────────────┐
│ 1. User inputs:                        │
│    • Amount: 1 USDC (1,000,000)        │
│    • Min output: 0 (100% slippage)     │
│                                        │
│ 2. Frontend generates salt:            │
│    salt = random(0, 2^256)             │
│                                        │
│ 3. Compute commitment:                 │
│    commitment = keccak256(             │
│      amount, minOut, salt              │
│    )                                   │
│                                        │
│ 4. Submit to CommitStore:              │
│    commit(commitment, nullifier)       │
│                                        │
│    Store: salt locally!                │
└────────────────────────────────────────┘
              │
              │ 10 blocks (~2 minutes)
              ▼
PHASE 2: WAIT (Blocks N+1 to N+9)
┌────────────────────────────────────────┐
│ • Commitment stored on-chain           │
│ • Block number recorded                │
│ • MEV bots cannot see amount           │
│ • Pool price may fluctuate             │
└────────────────────────────────────────┘
              │
              ▼
PHASE 3: REVEAL (Block N+10)
┌────────────────────────────────────────┐
│ 1. Approve token spend:                │
│    approve(router, amount)             │
│                                        │
│ 2. Build swap params:                  │
│    • zeroForOne: true/false            │
│    • amountSpecified: committed amt    │
│    • sqrtPriceLimitX96: min/max        │
│                                        │
│ 3. Build hook data:                    │
│    (commitment, salt, minOut)          │
│                                        │
│ 4. Execute swap through router         │
│                                        │
│ 5. DarkPoolHook verifies:              │
│    • Commitment exists                 │
│    • 10 blocks passed                  │
│    • Salt matches commitment           │
│    • Not already revealed              │
│                                        │
│ 6. Uniswap v4 executes swap            │
│                                        │
│ 7. User receives output tokens         │
└────────────────────────────────────────┘
```

**Using Foundry Script:**

The [ExecuteSwap.s.sol](script/ExecuteSwap.s.sol) script handles both commit and reveal phases:

```bash
# First run - COMMIT
forge script script/ExecuteSwap.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast \
    -vv

# Save the printed salt!

# Wait 10 blocks (~2 minutes)

# Update SALT constant in script with saved value

# Second run - REVEAL
forge script script/ExecuteSwap.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast \
    -vv
```

**Manual Steps:**

1. **Commit:**
```bash
forge script script/Commit.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast
```

2. **Wait 10 blocks:**
```bash
# Check current block
cast block-number --rpc-url $SEPOLIA_RPC_URL

# Wait for target block
```

3. **Reveal & Swap:**
```bash
forge script script/TestSwap.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast
```

---

## Key Parameters Reference

### Sqrt Price Limits

For swap price limits, use these constants:

```solidity
uint160 constant MIN_SQRT_PRICE = 4295128739;
uint160 constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
```

**Direction Rules:**
- **USDC → WETH** (zeroForOne = true): Use `MIN_SQRT_PRICE + 1`
- **WETH → USDC** (zeroForOne = false): Use `MAX_SQRT_PRICE - 1`

### Commitment Hash

```solidity
bytes32 commitment = keccak256(abi.encodePacked(
    amountIn,    // uint256: Input amount
    minOut,      // uint256: Minimum output (0 for 100% slippage)
    salt         // uint256: Random secret number
));
```

### Nullifier

```solidity
bytes32 nullifier = keccak256(abi.encodePacked(salt));
```

---

## Troubleshooting

### PriceLimitAlreadyExceeded
The pool price is at the limit for your swap direction. Try swapping in the opposite direction or wait for price to move.

### SwapAmountCannotBeZero
You're using `sqrtPriceLimitX96 = 0` which is invalid. Use `MIN_SQRT_PRICE + 1` or `MAX_SQRT_PRICE - 1`.

### CommitmentMismatch
The salt doesn't match the commitment. Make sure you're using the exact same salt, amount, and minOut from the commit phase.

### PoolNotInitialized
The pool hasn't been initialized. Run the InitPool script first.

---

## Successful Transactions (Sepolia)

| Type | Transaction Hash | Block |
|------|-----------------|-------|
| Swap (USDC→WETH) | `0xff4614e281d34e2a852b79eac661273aebbcfcdf93d7d897ae30a7289141ce27` | 10207029 |
| Swap (WETH→USDC) | `0x2c7bfdd28112c76c5ed34c3894b9f2d79d5a2bfa96b18f1c1c1e78176ff554c0` | - |

---

## Fix Pool Price Issue (New Pool)

If the pool price has drifted to minimum and swaps return 0, initialize a **new pool** with better parameters:

### 1. Initialize New Pool (0.05% fee tier)

```bash
forge script script/InitNewPool.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  -vv
```

**New Pool Parameters:**
- **Fee:** 500 (0.05%) - *Different from old pool's 3000 (0.3%)*
- **Initial Price:** 2000 USDC/ETH
- **Tick Spacing:** 10
- **Same Hook:** 0x1846217Bae61BF26612BD8d9a64b970d525B4080

### 2. Add Liquidity to New Pool

```bash
forge script script/AddLiquidityNewPool.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  -vv
```

**Amounts:**
- 1000 USDC + 0.5 WETH
- Wide tick range (-60000 to +80000)

### 3. Update Frontend

The frontend has been updated to use the new pool fee (500). Make sure these constants are set:

```typescript
// frontend/src/contracts/constants.ts
export const POOL_FEE = 500;
export const POOL_TICK_SPACING = 10;
```

### Why a New Pool?

Uniswap v4 pools cannot be re-initialized once created. Since the old pool (0.3% fee, price ~10,838) had drifted to minimum price due to limited liquidity, we create a new pool with:
- Lower fee (0.05% vs 0.3%) - attracts more liquidity
- Better initial price (2000 vs 10,838) - closer to market rate
- More initial liquidity - prevents price drift

---

## Contract Verification

To verify the contracts on Sepolia Etherscan (make source code visible):

### Prerequisites
Make sure `ETHERSCAN_API_KEY` is set in your `.env` file.

### Verify Commands

```bash
cd contracts/
source .env

# 1. Verify CommitStore (no constructor args)
forge verify-contract \
  --chain-id 11155111 \
  --watch \
  0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C \
  CommitStore

# 2. Verify DarkPoolHook (with constructor args)
forge verify-contract \
  --chain-id 11155111 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address,address)" 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C) \
  0x1846217Bae61BF26612BD8d9a64b970d525B4080 \
  DarkPoolHook

# 3. Verify SwapRouter (with constructor args)
forge verify-contract \
  --chain-id 11155111 \
  --watch \
  --constructor-args $(cast abi-encode "constructor(address,address,address)" 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C 0x1846217Bae61BF26612BD8d9a64b970d525B4080) \
  0x36b42E07273CD8ECfF1125bF15771AE356F085B1 \
  SwapRouter
```

### Constructor Arguments Reference

| Contract | Constructor Args |
|----------|-----------------|
| CommitStore | None |
| DarkPoolHook | `(poolManager, commitStore)` |
| SwapRouter | `(poolManager, commitStore, hook)` |

### Verification Status

| Contract | Address | Status |
|----------|---------|--------|
| CommitStore | `0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C` | ✅ [Verified](https://sepolia.etherscan.io/address/0xdc81d28a1721fcdE86d79ce26ba3b0bef24c116c#code) |
| DarkPoolHook | `0x1846217Bae61BF26612BD8d9a64b970d525B4080` | ⚠️ See Note Below |
| SwapRouter | `0x36b42E07273CD8ECfF1125bF15771AE356F085B1` | ✅ [Verified](https://sepolia.etherscan.io/address/0x36b42e07273cd8ecff1125bf15771ae356f085b1#code) |

**Note on DarkPoolHook:** This contract uses Uniswap v4's `BaseHook` which imports external libraries (`v4-core` and `v4-periphery`). For full transparency, the source code is available at:
- Main file: [`src/DarkPoolHook.sol`](src/DarkPoolHook.sol)
- Dependencies: `lib/v4-core/` and `lib/v4-periphery/`

To verify manually on Etherscan:
1. Use `forge flatten src/DarkPoolHook.sol > DarkPoolHook.flat.sol`
2. Upload the flattened file to Etherscan with:
   - Compiler: `v0.8.26+commit.8a97fa7a`
   - Optimization: **Disabled** (default for Foundry standard JSON)
   - Constructor args: `0x000000000000000000000000e03a1074c86cfedd5c142c4f04f1a1536e203543000000000000000000000000dc81d28a1721fcde86d79ce26ba3b0bef24c116c`

---

## Resources

- [Uniswap v4 Documentation](https://docs.uniswap.org/contracts/v4/overview)
- [Foundry Book](https://book.getfoundry.sh/)
- [Sepolia Testnet Explorer](https://sepolia.etherscan.io/)

## License

MIT
