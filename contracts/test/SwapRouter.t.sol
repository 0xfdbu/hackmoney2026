// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {SwapRouter} from "../src/SwapRouter.sol";
import {CommitStore} from "../src/CommitStore.sol";

contract SwapRouterTest is Test {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant ROUTER = 0x035c8980b8FdAcd324bEf3c17a67CCd6Eb32BaCC;
    
    address user = 0x89feEbA43b294425C0d7B482770eefbcc1359f8d;
    
    SwapRouter router;
    CommitStore commitStore;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
        router = SwapRouter(payable(ROUTER));
        commitStore = CommitStore(COMMIT_STORE);
    }
    
    function test_WETH_to_USDC_Swap() public {
        console.log("=== WETH -> USDC SWAP TEST ===");
        
        vm.startPrank(user);
        
        uint256 wethBefore = IERC20(WETH).balanceOf(user);
        uint256 usdcBefore = IERC20(USDC).balanceOf(user);
        
        console.log("WETH balance:", wethBefore);
        console.log("USDC balance:", usdcBefore);
        
        if (wethBefore < 0.001 ether) {
            console.log("SKIP: Not enough WETH");
            return;
        }
        
        // Commit
        uint256 salt = 12345;
        uint256 amount = 0.001 ether;
        bytes32 commitment = keccak256(abi.encodePacked(amount, uint256(0), salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        commitStore.commit(commitment, nullifier);
        console.log("Committed at block:", block.number);
        
        // Wait
        vm.roll(block.number + 11);
        console.log("Waited until block:", block.number);
        
        // Approve
        IERC20(WETH).approve(ROUTER, amount);
        console.log("Approved WETH");
        
        bytes memory hookData = abi.encode(commitment, salt, uint256(0));
        
        // Try all 4 combinations
        bool success = _trySwap(
            Currency.wrap(USDC), Currency.wrap(WETH), 
            10, false, amount, hookData, 
            "USDC=c0, WETH=c1, tick=10, zeroForOne=false"
        );
        if (success) return;
        
        success = _trySwap(
            Currency.wrap(WETH), Currency.wrap(USDC), 
            10, true, amount, hookData, 
            "WETH=c0, USDC=c1, tick=10, zeroForOne=true"
        );
        if (success) return;
        
        success = _trySwap(
            Currency.wrap(USDC), Currency.wrap(WETH), 
            60, false, amount, hookData, 
            "USDC=c0, WETH=c1, tick=60, zeroForOne=false"
        );
        if (success) return;
        
        success = _trySwap(
            Currency.wrap(WETH), Currency.wrap(USDC), 
            60, true, amount, hookData, 
            "WETH=c0, USDC=c1, tick=60, zeroForOne=true"
        );
        if (success) return;
        
        console.log("\n*** ALL 4 COMBINATIONS FAILED ***");
        console.log("Check that the pool was actually initialized with:");
        console.log("- Hook:", HOOK);
        console.log("- Fee: 500");
        console.log("- One of the currency orderings above");
        fail();
        
        vm.stopPrank();
    }
    
    function _trySwap(
        Currency currency0,
        Currency currency1,
        int24 tickSpacing,
        bool zeroForOne,
        uint256 amount,
        bytes memory hookData,
        string memory description
    ) internal returns (bool) {
        console.log("\n----------------------------------------");
        console.log("Trying:", description);
        
        PoolKey memory key = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: 500,
            tickSpacing: tickSpacing,
            hooks: IHooks(HOOK)
        });
        
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amount),
            sqrtPriceLimitX96: zeroForOne ? 4295128740 : 1461446703485210103287273052203988822378723970341
        });
        
        try router.swap(key, params, hookData) returns (BalanceDelta delta) {
            console.log("SUCCESS!");
            console.log("Delta0:", delta.amount0());
            console.log("Delta1:", delta.amount1());
            
            uint256 wethAfter = IERC20(WETH).balanceOf(user);
            uint256 usdcAfter = IERC20(USDC).balanceOf(user);
            console.log("Final WETH:", wethAfter);
            console.log("Final USDC:", usdcAfter);
            
            return true;
        } catch (bytes memory err) {
            if (err.length >= 4) {
                bytes4 selector;
                assembly { selector := mload(add(err, 32)) }
                if (selector == 0x486aa307) {
                    console.log("  -> PoolNotInitialized");
                } else {
                    console.log("  -> Error:", vm.toString(selector));
                }
            } else {
                console.log("  -> Unknown error");
            }
            return false;
        }
    }
}