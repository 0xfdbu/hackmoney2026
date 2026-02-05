// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract CheckPoolPriceScript is Script {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0xCAC28E99c67B2f54A92f602046136899dA296080;
    
    function run() external view {
        IPoolManager manager = IPoolManager(POOL_MANAGER);
        
        // WETH/USDC pool ( currency0 = USDC, currency1 = WETH)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        PoolId poolId = key.toId();
        console.log("Pool ID:");
        console.logBytes32(PoolId.unwrap(poolId));
        
        (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = manager.getSlot0(poolId);
        
        console.log("sqrtPriceX96:", sqrtPriceX96);
        console.log("Tick:", tick);
        console.log("Protocol fee:", protocolFee);
        console.log("LP fee:", lpFee);
        
        // Calculate price
        uint256 priceX96 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        uint256 price = priceX96 >> 192;
        console.log("Price (WETH per USDC):", price);
        
        // Get liquidity
        uint128 liquidity = manager.getLiquidity(poolId);
        console.log("Liquidity:", liquidity);
    }
}