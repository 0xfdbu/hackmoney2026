// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract CheckPool is Script {
    using PoolIdLibrary for PoolKey;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external view {
        // Check if pool exists with USDC as currency0, WETH as currency1
        PoolKey memory key1 = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        PoolId pid1 = key1.toId();
        console.log("Pool (USDC=curr0, WETH=curr1):");
        console.log("  Pool ID:");
        console.logBytes32(PoolId.unwrap(pid1));
        
        try IPoolManager(POOL_MANAGER).getLiquidity(pid1) returns (uint128 liq) {
            console.log("  Liquidity:", uint256(liq));
        } catch {
            console.log("  NOT INITIALIZED");
        }
        
        // Check reverse (WETH as currency0, USDC as currency1)
        PoolKey memory key2 = PoolKey({
            currency0: Currency.wrap(WETH),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        PoolId pid2 = key2.toId();
        console.log("\nPool (WETH=curr0, USDC=curr1):");
        console.log("  Pool ID:");
        console.logBytes32(PoolId.unwrap(pid2));
        
        try IPoolManager(POOL_MANAGER).getLiquidity(pid2) returns (uint128 liq) {
            console.log("  Liquidity:", uint256(liq));
        } catch {
            console.log("  NOT INITIALIZED");
        }
    }
}
