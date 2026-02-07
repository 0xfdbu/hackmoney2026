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

/**
 * @title ExecuteSwap
 * @notice Complete swap execution: Commit → Wait 10 blocks → Reveal
 * 
 * USAGE:
 * 1. Set SALT to a unique number (or leave 0 for auto-generated)
 * 2. First run: Commits the swap, saves the salt
 * 3. Wait 10 blocks (~2 minutes)
 * 4. Second run: Uses the same salt to reveal
 */
contract ExecuteSwap is Script {
    // Contract addresses (Sepolia)
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    // Sqrt price limits for Uniswap v4
    uint160 constant MIN_SQRT_PRICE = 4295128739;
    uint160 constant MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342;
    
    // CONFIGURATION - ADJUST THESE
    uint256 constant SWAP_AMOUNT = 0.001 ether;  // 0.001 WETH
    uint256 constant MIN_OUT = 0;                // 0 = 100% slippage
    
    // Set to 0 for first run (auto-generated), then copy the printed salt for reveal
    uint256 constant SALT = 49144478666166611925460681495033425606631504790954748242120734478153377218023;
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        // Use fixed salt if provided, otherwise generate one
        uint256 salt = SALT != 0 ? SALT : uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        
        bytes32 commitment = keccak256(abi.encodePacked(SWAP_AMOUNT, MIN_OUT, salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        console.log("=== PRIVYFLOW SWAP EXECUTION ===");
        console.log("Amount:", SWAP_AMOUNT);
        console.log("Salt:", salt);
        console.log("(COPY THIS SALT FOR REVEAL PHASE)");
        console.log("Commitment:", vm.toString(commitment));
        console.log("");
        
        // Check commitment status
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        
        // PHASE 1: COMMIT
        if (user == address(0)) {
            console.log("PHASE 1: COMMITTING");
            console.log("-------------------");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("Reveal block:", block.number + 10);
            console.log("");
            console.log("=== SAVE THIS SALT ===");
            console.log(salt);
            console.log("======================");
            console.log("");
            console.log("NEXT STEPS:");
            console.log("1. Copy the salt above");
            console.log("2. Set SALT constant in this script");
            console.log("3. Wait 10 blocks (~2 minutes)");
            console.log("4. Run this script again");
            vm.stopBroadcast();
            return;
        }
        
        // PHASE 2: REVEAL
        console.log("PHASE 2: REVEALING");
        console.log("------------------");
        console.log("Committed at block:", submitBlock);
        console.log("Current block:", block.number);
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, SWAP_AMOUNT, MIN_OUT, salt)) {
            uint256 blocksNeeded = (submitBlock + 10) > block.number ? (submitBlock + 10 - block.number) : 0;
            console.log("Cannot reveal yet. Wait", blocksNeeded, "more blocks");
            vm.stopBroadcast();
            return;
        }
        
        console.log("Ready to reveal! Executing swap...");
        console.log("");
        
        // Approve WETH
        (bool approved,) = WETH.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, SWAP_AMOUNT));
        require(approved, "WETH approve failed");
        console.log("WETH approved for router");
        
        // Build pool key
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // Build swap params - WETH -> USDC (zeroForOne = false)
        SwapParams memory params = SwapParams({
            zeroForOne: false,                    // false = WETH -> USDC
            amountSpecified: int256(SWAP_AMOUNT),
            sqrtPriceLimitX96: MAX_SQRT_PRICE - 1 // Use max price - 1
        });
        
        // Build hook data
        bytes memory hookData = abi.encode(commitment, salt, MIN_OUT);
        
        console.log("Pool Key:");
        console.log("  Currency0 (USDC):", USDC);
        console.log("  Currency1 (WETH):", WETH);
        console.log("  Fee: 3000 (0.3%)");
        console.log("  TickSpacing: 60");
        console.log("  Hook:", HOOK);
        console.log("");
        console.log("Swap Params:");
        console.log("  zeroForOne:", params.zeroForOne);
        console.log("  amountSpecified:", uint256(params.amountSpecified));
        console.log("  sqrtPriceLimitX96:", uint256(params.sqrtPriceLimitX96));
        console.log("");
        
        // Execute swap
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (bytes memory result) {
            console.log("SWAP SUCCESSFUL!");
            console.log("Result length:", result.length);
        } catch Error(string memory reason) {
            console.log("SWAP FAILED:", reason);
        } catch (bytes memory err) {
            console.log("SWAP FAILED with error:");
            console.logBytes(err);
        }
        
        vm.stopBroadcast();
    }
}
