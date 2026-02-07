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

contract TestFrontendParams is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    uint160 constant MIN_SQRT_PRICE = 4295128739;
    
    // Frontend params (from logs)
    uint256 constant SALT = 8908001854157713408;
    uint256 constant AMOUNT = 1000000; // 1 USDC
    uint256 constant MIN_OUT = 0;
    bytes32 constant COMMITMENT = 0x463f7033e244de2b9b6ee0db6e1c5f5aa4ab74642945eea6b17f06eddd5b7eb3;
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        bytes32 nullifier = keccak256(abi.encodePacked(SALT));
        
        console.log("=== Testing Frontend Parameters ===");
        console.log("Salt:", SALT);
        console.log("Amount:", AMOUNT);
        console.log("MinOut:", MIN_OUT);
        console.log("Commitment:", vm.toString(COMMITMENT));
        
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(COMMITMENT);
        
        if (user == address(0)) {
            console.log("\nCommitting...");
            ICommitStore(COMMIT_STORE).commit(COMMITMENT, nullifier);
            console.log("Committed at block:", block.number);
            vm.stopBroadcast();
            return;
        }
        
        console.log("\nAlready committed at block:", submitBlock);
        console.log("Current block:", block.number);
        
        if (!ICommitStore(COMMIT_STORE).canReveal(COMMITMENT, AMOUNT, MIN_OUT, SALT)) {
            console.log("Cannot reveal yet");
            vm.stopBroadcast();
            return;
        }
        
        console.log("Ready to reveal!");
        
        // Approve USDC
        (bool approved,) = USDC.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, AMOUNT));
        require(approved, "USDC approve failed");
        console.log("USDC approved");
        
        // Build pool key (EXACT same as frontend)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // Build swap params (EXACT same as frontend)
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: int256(AMOUNT),
            sqrtPriceLimitX96: MIN_SQRT_PRICE + 1
        });
        
        // Build hook data (EXACT same as frontend)
        bytes memory hookData = abi.encode(COMMITMENT, SALT, MIN_OUT);
        
        console.log("\nPool Key:");
        console.log("  currency0:", USDC);
        console.log("  currency1:", WETH);
        console.log("  fee: 3000");
        console.log("  tickSpacing: 60");
        console.log("  hooks:", HOOK);
        
        console.log("\nSwap Params:");
        console.log("  zeroForOne:", params.zeroForOne);
        console.log("  amountSpecified:", uint256(params.amountSpecified));
        console.log("  sqrtPriceLimitX96:", uint256(params.sqrtPriceLimitX96));
        
        console.log("\nHook Data:");
        console.logBytes(hookData);
        
        console.log("\nExecuting swap...");
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (bytes memory) {
            console.log("SUCCESS!");
        } catch Error(string memory reason) {
            console.log("FAILED:", reason);
        } catch (bytes memory err) {
            console.log("FAILED with error:");
            console.logBytes(err);
        }
        
        vm.stopBroadcast();
    }
}
