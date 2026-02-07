// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol"; // Add PoolId
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {console} from "forge-std/console.sol";

import {BaseScript} from "./base/BaseScript.sol";
import {LiquidityHelpers} from "./base/LiquidityHelpers.sol";

contract AddLiquidityScript is BaseScript, LiquidityHelpers {
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey; // Add this

    uint24 lpFee = 10000; // 1%
    int24 tickSpacing = 200;
    
    uint256 public token0Amount = 100 * 1e6;
    uint256 public token1Amount = 0.05 ether;

    int24 tickLower;
    int24 tickUpper;

    function run() external {
        // Debug: Log the actual addresses being used
        console.log("currency0:", Currency.unwrap(currency0)); // Fix here
        console.log("currency1:", Currency.unwrap(currency1)); // Fix here
        console.log("hookContract:", address(hookContract));
        console.log("lpFee:", lpFee);
        console.log("tickSpacing:", tickSpacing);

        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: lpFee,
            tickSpacing: tickSpacing,
            hooks: hookContract
        });
        
        bytes memory hookData = new bytes(0);
        
        // Debug: Log pool ID - convert PoolId to bytes32
        PoolId pid = poolKey.toId();
        console.log("Pool ID:");
        console.logBytes32(PoolId.unwrap(pid)); // Fix here

        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(pid);

        if (sqrtPriceX96 == 0) {
            console.log("ERROR: Pool not initialized!");
            console.log("Parameters used:");
            console.log("  currency0:", Currency.unwrap(currency0)); // Fix
            console.log("  currency1:", Currency.unwrap(currency1)); // Fix
            console.log("  fee:", lpFee);
            console.log("  tickSpacing:", tickSpacing);
            console.log("  hooks:", address(hookContract));
            return;
        }
        
        console.log("Pool found! sqrtPriceX96:", sqrtPriceX96);

        int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);

        tickLower = truncateTickSpacing((currentTick - 10 * tickSpacing), tickSpacing);
        tickUpper = truncateTickSpacing((currentTick + 10 * tickSpacing), tickSpacing);
        
        console.log("Current tick:"); console.logInt(currentTick);
        console.log("Range:"); console.logInt(tickLower); console.logInt(tickUpper);

        uint128 liquidity = 1e15;

        uint256 amount0Max = token0Amount + 1;
        uint256 amount1Max = token1Amount + 1;

        (bytes memory actions, bytes[] memory mintParams) = _mintLiquidityParams(
            poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, deployerAddress, hookData
        );

        bytes[] memory params = new bytes[](1);
        params[0] = abi.encodeWithSelector(
            positionManager.modifyLiquidities.selector, 
            abi.encode(actions, mintParams), 
            block.timestamp + 3600
        );

        uint256 valueToPass = currency0.isAddressZero() ? amount0Max : 0;

        vm.startBroadcast();
        tokenApprovals();

        console.log("Adding liquidity...");
        positionManager.multicall{value: valueToPass}(params);
        console.log("Success!");
        
        vm.stopBroadcast();
    }
}