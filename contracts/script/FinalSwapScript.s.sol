// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

interface ICommitStore {
    function commit(bytes32 commitmentHash, bytes32 nullifier) external;
    function canReveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt) external view returns (bool);
    function reveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt) external;
    function commitments(bytes32) external view returns (address user, uint256 amountIn, uint256 minAmountOut, uint256 submitBlock, bool revealed);
}

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData) external payable returns (BalanceDelta);
}

contract FinalSwapScript is Script {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant ROUTER = 0x035c8980b8FdAcd324bEf3c17a67CCd6Eb32BaCC;
    
    uint24 constant FEE = 500;        
    int24 constant TICK_SPACING = 10; 
    uint256 constant AMOUNT_IN = 0.001 ether;  
    uint256 constant MIN_AMOUNT_OUT = 0;       
    uint256 constant SALT = 3432334;
    
    function run() external {
        address user = vm.addr(vm.envUint("PRIVATE_KEY"));
        console.log("=== Dark Pool Swap WETH -> USDC ===");
        console.log("User:", user);
        console.log("Amount:", AMOUNT_IN);
        
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        uint256 wethBefore = IERC20(WETH).balanceOf(user);
        uint256 usdcBefore = IERC20(USDC).balanceOf(user);
        console.log("WETH balance:", wethBefore);
        console.log("USDC balance:", usdcBefore);
        
        require(wethBefore >= AMOUNT_IN, "Insufficient WETH balance");
        
        bytes32 commitment = keccak256(abi.encodePacked(AMOUNT_IN, MIN_AMOUNT_OUT, SALT));
        bytes32 nullifier = keccak256(abi.encodePacked(SALT));
        
        ICommitStore commitStore = ICommitStore(COMMIT_STORE);
        (address commitUser,,, uint256 submitBlock, bool revealed) = commitStore.commitments(commitment);
        
        if (commitUser == address(0)) {
            console.log("Creating new commitment...");
            commitStore.commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("Wait 10+ blocks, then run again");
            vm.stopBroadcast();
            return;
        }
        
        if (revealed) {
            console.log("ERROR: Already revealed!");
            vm.stopBroadcast();
            return;
        }
        
        uint256 blocksWaited = block.number - submitBlock;
        console.log("Blocks waited:", blocksWaited);
        
        if (blocksWaited < 10) {
            console.log("Wait", 10 - blocksWaited, "more blocks");
            vm.stopBroadcast();
            return;
        }
        
        require(commitStore.canReveal(commitment, AMOUNT_IN, MIN_AMOUNT_OUT, SALT), "Cannot reveal");
        console.log("Commitment ready");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        SwapParams memory params = SwapParams({
            zeroForOne: false,
            amountSpecified: -int256(AMOUNT_IN),
            sqrtPriceLimitX96: TickMath.MAX_SQRT_PRICE - 1
        });
        
        IERC20(WETH).approve(ROUTER, AMOUNT_IN);
        console.log("Approved WETH, executing...");
        
        try ISwapRouter(ROUTER).swap(key, params, abi.encode(commitment, SALT, MIN_AMOUNT_OUT)) returns (BalanceDelta delta) {
            console.log("Swap successful!");
            console.log("Delta amount0:", delta.amount0());
            console.log("Delta amount1:", delta.amount1());
            console.log("WETH spent:", wethBefore - IERC20(WETH).balanceOf(user));
            console.log("USDC received:", IERC20(USDC).balanceOf(user) - usdcBefore);
        } catch (bytes memory err) {
            if (err.length >= 4) {
                bytes4 selector; 
                assembly { selector := mload(add(err, 32)) }
                console.log("Error selector:");
                console.logBytes4(selector);
                if (selector == 0x7c9c6e8f) console.log("Price limit exceeded");
                if (selector == 0x486aa307) console.log("Pool not initialized");
            }
            revert("Swap failed");
        }
        
        vm.stopBroadcast();
    }
}