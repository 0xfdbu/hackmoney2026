# PrivyFlow Swap Execution Guide

This document contains the complete process for executing a successful dark pool swap on Sepolia testnet.

## Successful Swap Transaction

**Transaction Hash:** `0xff4614e281d34e2a852b79eac661273aebbcfcdf93d7d897ae30a7289141ce27`

**Explorer:** https://sepolia.etherscan.io/tx/0xff4614e281d34e2a852b79eac661273aebbcfcdf93d7d897ae30a7289141ce27

**Details:**
- Direction: USDC → WETH (zeroForOne = true)
- Amount: 1 USDC (1,000,000)
- Committed: Block 10207019
- Revealed: Block 10207029 (10 blocks later)
- Status: ✅ SUCCESS

---

## Contract Addresses (Sepolia)

```solidity
address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
```

---

## Key Parameters

### Sqrt Price Limits
```solidity
uint160 constant MIN_SQRT_PRICE = 4295128739;
uint160 constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
```

### Direction Rules
- **USDC → WETH** (zeroForOne = true): Price goes DOWN → Use `MIN_SQRT_PRICE + 1`
- **WETH → USDC** (zeroForOne = false): Price goes UP → Use `MAX_SQRT_PRICE - 1`

### Important Notes
- **sqrtPriceLimitX96 = 0 is INVALID** - causes `SwapAmountCannotBeZero()`
- Use **100% slippage** (minOut = 0) for testing
- Pool price fluctuates - if one direction fails with `PriceLimitAlreadyExceeded`, try the opposite direction

---

## Complete Swap Script

See `ExecuteSwapUSDC.s.sol` for the working USDC → WETH swap script.

### Step 1: Commit
```bash
cd contracts
forge script script/ExecuteSwapUSDC.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast -vv
```

**Output:** Save the printed salt!

### Step 2: Wait 10 Blocks
```bash
# Check current block
cast block-number --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Or wait in a loop
TARGET=10207028  # Replace with your reveal block
while true; do
  BLOCK=$(cast block-number --rpc-url https://ethereum-sepolia-rpc.publicnode.com)
  echo "Current: $BLOCK / Target: $TARGET"
  if [ "$BLOCK" -ge "$TARGET" ]; then echo "Ready!"; break; fi
  sleep 10
done
```

### Step 3: Reveal (Update SALT constant first!)
Edit `ExecuteSwapUSDC.s.sol` and set:
```solidity
uint256 constant SALT = 48208200747286979484880102624422250187739261721973404144477334400866962567443; // Your saved salt
```

Then run:
```bash
forge script script/ExecuteSwapUSDC.s.sol \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com \
  --broadcast -vv
```

---

## Common Errors & Solutions

### `SwapAmountCannotBeZero()` (0x9e4d7cc7)
**Cause:** `sqrtPriceLimitX96 = 0` is invalid
**Fix:** Use `MIN_SQRT_PRICE + 1` or `MAX_SQRT_PRICE - 1`

### `PriceLimitAlreadyExceeded` (0x7c9c6e8f)
**Cause:** Pool price is at limit for your swap direction
**Fix:** Try swapping in the opposite direction
- If WETH→USDC fails, try USDC→WETH
- If USDC→WETH fails, try WETH→USDC

### `Commitment mismatch`
**Cause:** Salt/amount/minOut changed between commit and reveal
**Fix:** Use the EXACT same salt that was printed during commit

### `PoolNotInitialized`
**Cause:** Pool doesn't exist
**Fix:** The pool is already initialized, this shouldn't happen

---

## Working Script (ExecuteSwapUSDC.s.sol)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external payable returns (bytes memory);
}

interface ICommitStore {
    function canReveal(bytes32, uint256, uint256, uint256) external view returns (bool);
    function commit(bytes32, bytes32) external;
    function commitments(bytes32) external view returns (address, uint256, uint256, uint256, bool);
}

contract ExecuteSwapUSDC is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    uint160 constant MIN_SQRT_PRICE = 4295128739;
    
    uint256 constant SWAP_AMOUNT = 1_000_000; // 1 USDC
    uint256 constant MIN_OUT = 0;
    uint256 constant SALT = 0; // Set after first run
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        uint256 salt = SALT != 0 ? SALT : uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        
        bytes32 commitment = keccak256(abi.encodePacked(SWAP_AMOUNT, MIN_OUT, salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        
        if (user == address(0)) {
            console.log("PHASE 1: COMMITTING");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("=== SAVE THIS SALT ===");
            console.log(salt);
            console.log("======================");
            vm.stopBroadcast();
            return;
        }
        
        console.log("PHASE 2: REVEALING");
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, SWAP_AMOUNT, MIN_OUT, salt)) {
            console.log("Wait more blocks");
            vm.stopBroadcast();
            return;
        }
        
        // Approve USDC
        (bool approved,) = USDC.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, SWAP_AMOUNT));
        require(approved, "USDC approve failed");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // USDC -> WETH (zeroForOne = true)
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: int256(SWAP_AMOUNT),
            sqrtPriceLimitX96: MIN_SQRT_PRICE + 1
        });
        
        bytes memory hookData = abi.encode(commitment, salt, MIN_OUT);
        
        ISwapRouter(ROUTER).swap(key, params, hookData);
        
        vm.stopBroadcast();
    }
}
```

---

## Quick Reference Commands

```bash
# Check balance
cast balance $ADDRESS --rpc-url https://ethereum-sepolia-rpc.publicnode.com
cast call $USDC "balanceOf(address)" $ADDRESS --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Check block number
cast block-number --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Check transaction
cast tx $TX_HASH --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```
