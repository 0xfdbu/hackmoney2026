# PrivyFlow Contracts

Dark pool DEX on Uniswap v4 using commit-reveal hooks for MEV protection.

## Prerequisites

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge install
```

## Environment

Create `.env`:
```bash
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
PRIVATE_KEY=0x...
```

Load it:
```bash
source .env
```

## Deploy

Deploy all contracts (CommitStore, DarkPoolHook, SwapRouter):

```bash
forge script script/DeployPrivyFlow.s.sol:DeployPrivyFlow \
    --rpc-url $SEPOLIA_RPC_URL \
    --broadcast
```

The script automatically mines a salt for the DarkPoolHook to get the `BEFORE_SWAP` flag (address ending in `0x04`).

## Verify

```bash
# CommitStore
forge verify-contract --chain-id 11155111 --watch [ADDRESS] CommitStore

# DarkPoolHook
forge verify-contract --chain-id 11155111 --watch \
  --constructor-args $(cast abi-encode "constructor(address,address)" [POOL_MANAGER] [COMMIT_STORE]) \
  [ADDRESS] DarkPoolHook

# SwapRouter  
forge verify-contract --chain-id 11155111 --watch \
  --constructor-args $(cast abi-encode "constructor(address)" [POOL_MANAGER]) \
  [ADDRESS] SwapRouter
```