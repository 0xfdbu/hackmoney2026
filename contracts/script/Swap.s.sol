// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface ICommitStore {
    function commit(bytes32 commitmentHash, bytes32 nullifier) external;
    function canReveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt) external view returns (bool);
    function reveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt) external;
    function commitments(bytes32) external view returns (address user, uint256 amountIn, uint256 minAmountOut, uint256 submitBlock, bool revealed);
}

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData) external payable returns (BalanceDelta);
}

contract SwapScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant ROUTER = 0x035c8980b8FdAcd324bEf3c17a67CCd6Eb32BaCC;
    
    uint256 constant AMOUNT_IN = 0.001 ether;
    uint256 constant MIN_AMOUNT_OUT = 0;
    uint256 constant SALT = 343434;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("=== SWAP WETH -> USDC ===");
        console.log("User:", user);
        
        vm.startBroadcast(pk);
        
        uint256 wethBefore = IERC20(WETH).balanceOf(user);
        uint256 usdcBefore = IERC20(USDC).balanceOf(user);
        console.log("WETH balance:", wethBefore);
        console.log("USDC balance:", usdcBefore);
        
        require(wethBefore >= AMOUNT_IN, "Insufficient WETH");
        
        ICommitStore commitStore = ICommitStore(COMMIT_STORE);
        bytes32 commitment = keccak256(abi.encodePacked(AMOUNT_IN, MIN_AMOUNT_OUT, SALT));
        
        (address commitUser,,, uint256 submitBlock, bool revealed) = commitStore.commitments(commitment);
        
        if (commitUser == address(0)) {
            console.log("ERROR: Commitment not found! Run CommitScript first.");
            vm.stopBroadcast();
            return;
        }
        
        if (revealed) {
            console.log("ERROR: Commitment already revealed!");
            vm.stopBroadcast();
            return;
        }
        
        uint256 blocksWaited = block.number - submitBlock;
        console.log("Commit block:", submitBlock);
        console.log("Current block:", block.number);
        console.log("Blocks waited:", blocksWaited);
        
        if (blocksWaited < 10) {
            console.log("ERROR: Wait more blocks!");
            vm.stopBroadcast();
            return;
        }
        
        bool canReveal = commitStore.canReveal(commitment, AMOUNT_IN, MIN_AMOUNT_OUT, SALT);
        console.log("Can reveal:", canReveal);
        require(canReveal, "Cannot reveal yet");
        
        IERC20(WETH).approve(ROUTER, AMOUNT_IN);
        console.log("Approved WETH");
        
        bytes memory hookData = abi.encode(commitment, SALT, MIN_AMOUNT_OUT);
        ISwapRouter router = ISwapRouter(ROUTER);
        
        bool success = _trySwap(router, Currency.wrap(USDC), Currency.wrap(WETH), 10, false, AMOUNT_IN, hookData, "USDC=c0, WETH=c1, tick=10, zeroForOne=false");
        if (success) { _logFinalBalances(user); vm.stopBroadcast(); return; }
        
        success = _trySwap(router, Currency.wrap(WETH), Currency.wrap(USDC), 10, true, AMOUNT_IN, hookData, "WETH=c0, USDC=c1, tick=10, zeroForOne=true");
        if (success) { _logFinalBalances(user); vm.stopBroadcast(); return; }
        
        success = _trySwap(router, Currency.wrap(USDC), Currency.wrap(WETH), 60, false, AMOUNT_IN, hookData, "USDC=c0, WETH=c1, tick=60, zeroForOne=false");
        if (success) { _logFinalBalances(user); vm.stopBroadcast(); return; }
        
        success = _trySwap(router, Currency.wrap(WETH), Currency.wrap(USDC), 60, true, AMOUNT_IN, hookData, "WETH=c0, USDC=c1, tick=60, zeroForOne=true");
        if (success) { _logFinalBalances(user); vm.stopBroadcast(); return; }
        
        console.log("*** ALL COMBINATIONS FAILED ***");
        vm.stopBroadcast();
    }
    
    function _trySwap(ISwapRouter router, Currency currency0, Currency currency1, int24 tickSpacing, bool zeroForOne, uint256 amount, bytes memory hookData, string memory description) internal returns (bool) {
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
            // CRITICAL FIX: Separate console.log calls (Foundry doesn't support multiple args)
            console.log("SUCCESS!");
            console.log("Delta0:", delta.amount0());
            console.log("Delta1:", delta.amount1());
            return true;
        } catch (bytes memory err) {
            if (err.length >= 4) {
                bytes4 selector;
                assembly { selector := mload(add(err, 32)) }
                console.log("Error:", vm.toString(selector));
            }
            return false;
        }
    }
    
    function _logFinalBalances(address user) internal {
        console.log("Final WETH:", IERC20(WETH).balanceOf(user));
        console.log("Final USDC:", IERC20(USDC).balanceOf(user));
    }
}

contract CommitScript is Script {
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    
    uint256 constant AMOUNT_IN = 0.001 ether;
    uint256 constant MIN_AMOUNT_OUT = 0;
    uint256 constant SALT = 343434;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(pk);
        
        ICommitStore commitStore = ICommitStore(COMMIT_STORE);
        
        bytes32 commitment = keccak256(abi.encodePacked(AMOUNT_IN, MIN_AMOUNT_OUT, SALT));
        bytes32 nullifier = keccak256(abi.encodePacked(SALT));
        
        console.log("Committing at block:", block.number);
        console.log("Commitment:", vm.toString(commitment));
        
        try commitStore.commit(commitment, nullifier) {
            console.log("Success! Wait 10 blocks then run SwapScript");
        } catch Error(string memory reason) {
            console.log("Failed:", reason);
        } catch (bytes memory err) {
            console.log("Failed with bytes");
        }
        
        vm.stopBroadcast();
    }
}