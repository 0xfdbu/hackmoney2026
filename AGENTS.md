# PrivyFlow - AGENTS.md

## Project Overview

**PrivyFlow** is a privacy-preserving Dark Pool DEX built on Uniswap v4 hooks. It enables users to submit encrypted trade commitments using Zero-Knowledge (ZK) proofs, which are batch-settled after a time delay to prevent MEV and front-running.

### Key Concepts

- **Dark Pool**: A private exchange where orders are hidden until batch settlement
- **ZK Proof**: Users generate proofs to verify their commitment without revealing amounts
- **Batch Settlement**: Orders are collected in batches and settled together after ~10 blocks
- **Uniswap v4 Hook**: The core logic is implemented as a hook that intercepts swaps

## Technology Stack

### Circuits (ZK Layer)
- **Language**: Circom 2.1.6
- **Proving System**: Groth16 (via snarkjs)
- **Library**: circomlib (Poseidon hash, comparators)
- **PTAU**: powersOfTau28_hez_final_12.ptau

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
- **ZK Client**: snarkjs (browser bundle)

## Project Structure

```
.
├── circuits/                    # ZK circuits and artifacts
│   ├── darkpool.circom         # Main circuit definition
│   ├── darkpool_js/            # WASM witness generator
│   ├── darkpool_final.zkey     # Proving key
│   ├── verification_key.json   # Verification key
│   ├── darkpool.r1cs           # R1CS constraint system
│   └── circomlib/              # Circom standard library (git submodule)
│
├── contracts/                   # Solidity smart contracts
│   ├── src/
│   │   ├── DarkPoolHook.sol    # Main Uniswap v4 hook
│   │   └── DarkPoolVerifier.sol # Auto-generated Groth16 verifier
│   ├── script/
│   │   ├── DeployDarkPoolHook.s.sol  # Hook deployment with salt mining
│   │   └── DeployVerifier.s.sol      # Verifier deployment
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
    │   │   ├── Swap.tsx       # Dark pool swap interface
    │   │   ├── ManageLiquidity.tsx  # Liquidity management
    │   │   ├── Explore.tsx    # Pool exploration
    │   │   └── Portfolio.tsx  # User portfolio
    │   ├── components/
    │   │   ├── Layout/        # Page layout wrapper
    │   │   ├── Header/        # Navigation header
    │   │   ├── Sidebar/       # Side navigation
    │   │   └── Footer/        # Page footer
    │   ├── contracts/
    │   │   ├── constants.ts   # Contract addresses
    │   │   ├── abis.ts        # PoolManager ABI
    │   │   └── privyFlowHookABI.ts  # Hook ABI
    │   └── utils/
    │       └── zkProofUtils.ts # ZK proof generation helpers
    ├── public/
    │   ├── darkpool.wasm      # Circuit WASM (copied from circuits/)
    │   ├── darkpool_final.zkey # Proving key (copied from circuits/)
    │   ├── verification_key.json
    │   └── snarkjs.min.js     # Browser snarkjs bundle
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

## Circuit Specification

### Inputs

**Private Inputs** (hidden from public):
- `amount_in`: Trade input amount
- `min_amount_out`: Minimum output (slippage protection)
- `salt`: Random value for commitment uniqueness
- `private_key`: User's secret for nullifier generation

**Public Inputs**:
- `batch_id`: Current batch identifier
- `max_price_impact`: Maximum allowed slippage (basis points)
- `oracle_price`: External price reference (e.g., Chainlink)

**Outputs** (automatically public):
- `commitment`: Poseidon(amount_in, salt) - order commitment
- `nullifier`: Poseidon(private_key, batch_id) - prevents double-spending
- `valid`: Boolean indicating constraints satisfied

### Constraints

1. `amount_in > 0`
2. `min_amount_out >= amount_in * oracle_price * (10000 - max_price_impact) / 10000`
3. `valid = (amount_in > 0) AND (slippage_ok)`

## Build Commands

### Circuits

```bash
cd circuits/

# Download PTAU file (one-time)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau -O pot12_final.ptau

# Compile circuit
circom darkpool.circom --r1cs --wasm --sym -l .

# Trusted setup
snarkjs groth16 setup darkpool.r1cs pot12_final.ptau darkpool_0000.zkey
snarkjs zkey contribute darkpool_0000.zkey darkpool_final.zkey --name="Hackathon" -v -e="hackathon2026"

# Export artifacts
snarkjs zkey export verificationkey darkpool_final.zkey verification_key.json
snarkjs zkey export solidityverifier darkpool_final.zkey ../contracts/src/DarkPoolVerifier.sol

# Copy to frontend
mkdir -p ../frontend/public
cp darkpool_js/darkpool.wasm ../frontend/public/
cp darkpool_final.zkey ../frontend/public/
cp verification_key.json ../frontend/public/
```

### Smart Contracts

```bash
cd contracts/

# Install dependencies
forge install

# Compile
forge build

# Run tests
forge test

# Deploy to Sepolia
source .env
forge script script/DeployDarkPoolHook.s.sol \
    --rpc-url $SEPOLIA_RPC_URL \
    --private-key $PRIVATE_KEY \
    --broadcast
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

# Preview production build
npm run preview

# Lint
npm run lint
```

## Deployment Addresses (Sepolia)

| Contract | Address |
|----------|---------|
| DarkPoolHook | `0x82dF8D3352ac04b03a5E1a090A0C19BE8f7A9162` |
| Groth16Verifier | `0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981` |
| PoolManager | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |

## Smart Contract Architecture

### DarkPoolHook.sol

Implements `IHooks` interface for Uniswap v4 integration.

**Key Features**:
- Hook permissions: `beforeInitialize` (bit 159) + `beforeSwap` (bit 153) = prefix `0x82`
- Salt mining ensures deployed address matches required prefix
- Batch-based order collection with 10-block settlement delay
- Nullifier tracking prevents double-spending

**Core Functions**:
- `beforeSwap()`: Verifies ZK proof, records commitment, checks nullifier
- `settleBatch()`: Callable by anyone after batch duration, emits clearing price
- `getBatchInfo()`: View function for batch state

### DarkPoolVerifier.sol

Auto-generated by snarkjs. Implements Groth16 verification on-chain.

- Verifies proof elements: `a[2]`, `b[2][2]`, `c[2]`
- Validates 6 public signals
- Uses precompiled contract at address 8 for pairing check

## Frontend Architecture

### Wallet Integration

Uses Reown AppKit with Wagmi adapter:
- Single network: Sepolia
- Embedded wallet modal
- Project ID from environment or hardcoded fallback

### ZK Proof Generation Flow

1. User inputs amount and slippage tolerance
2. Generate random `salt` and `private_key`
3. Fetch `currentBatchId` from hook contract
4. Generate proof using snarkjs in browser:
   - Load WASM and zkey files
   - Call `groth16.fullProve()`
5. Encode proof for contract call
6. Submit swap via PoolManager with hookData containing proof

### State Management

- **Wagmi**: Ethereum connection, balance, contract reads/writes
- **React Query**: Caching and async state
- **React Router**: Navigation between pages

## Development Conventions

### Git Submodules

The project uses git submodules for contract dependencies:
```bash
# Initialize after clone
git submodule update --init --recursive

# Update to latest
git submodule update --remote
```

### Environment Variables

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

### Code Style

- **Solidity**: MIT license headers, explicit visibility, custom errors preferred
- **TypeScript**: Strict mode enabled, explicit return types
- **Circom**: Template-based, include circomlib via relative path

## Testing Strategy

### Current State

- **Contracts**: No active tests (test directory is empty)
- **Circuits**: No automated tests configured
- **Frontend**: Manual testing via browser

### Recommended Testing Approach

1. **Circuit Tests**: Use `circom_tester` to verify constraint satisfaction
2. **Contract Tests**: Use Foundry's `forge test` with mock PoolManager
3. **Integration Tests**: Test full flow from proof generation to settlement

### Local Development

```bash
# Start local Anvil node
anvil --code-size-limit 40000

# Deploy contracts locally
forge script script/DeployDarkPoolHook.s.sol \
    --rpc-url http://localhost:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --broadcast
```

## Security Considerations

1. **Trusted Setup**: The circuit uses a single-contribution trusted setup. For production, use a multi-party ceremony.

2. **Salt Mining**: Hook address must have specific prefix bits. Deployment script brute-forces salt values.

3. **Oracle Price**: Currently mocked in frontend. Production should use Chainlink or similar.

4. **Batch Settlement**: Anyone can call `settleBatch()` and set the clearing price. Consider adding access control or price oracle validation.

5. **Private Key Handling**: User's private key for nullifier is generated client-side and never leaves the browser.

6. **Front-running**: The batch-based settlement provides MEV resistance, but the settling transaction itself could be targeted.

## Common Issues

### Hook Deployment Fails
- Verify CREATE2 deployer is available at `0x4e59b44847b379578588920cA78FbF26c0B4956C`
- Ensure Foundry is up to date: `foundryup`

### Proof Generation Fails
- Check that WASM and zkey files are in `frontend/public/`
- Verify snarkjs is loaded: check browser console for `window.snarkjs`

### Contract Verification
- Use `forge verify-contract` after deployment
- Constructor args must be ABI-encoded correctly

## Resources

- [Uniswap v4 Docs](https://docs.uniswap.org/contracts/v4/overview)
- [Circom Documentation](https://docs.circom.io/)
- [SnarkJS Guide](https://github.com/iden3/snarkjs)
- [Foundry Book](https://book.getfoundry.sh/)
