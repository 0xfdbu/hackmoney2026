// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract CheckPool is Script {
    using PoolIdLibrary for PoolKey;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    
    function run() external view {
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
        
        // Get pool slot0
        (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee) = IPoolManager(POOL_MANAGER).getSlot0(poolId);
        
        console.log("sqrtPriceX96:", uint256(sqrtPriceX96));
        console.log("tick:", int256(tick));
        console.log("protocolFee:", uint256(protocolFee));
        console.log("lpFee:", uint256(lpFee));
        
        // Check liquidity
        uint128 liquidity = IPoolManager(POOL_MANAGER).getLiquidity(poolId);
        console.log("Liquidity:", uint256(liquidity));
    }
}
