// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

// Minimal test to debug the swap issue
contract TestDirectSwap is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        console.log("Testing pool configuration...");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 100000,
            sqrtPriceLimitX96: 0
        });
        
        console.log("amountSpecified value:", uint256(params.amountSpecified > 0 ? params.amountSpecified : -params.amountSpecified));
        console.log("zeroForOne:", params.zeroForOne);
        console.log("sqrtPriceLimitX96:", uint256(params.sqrtPriceLimitX96));
        
        // Try calling the PoolManager directly without the router
        try IPoolManager(POOL_MANAGER).swap(key, params, "") returns (BalanceDelta) {
            console.log("Direct swap succeeded (unexpected)");
        } catch Error(string memory reason) {
            console.log("Direct swap failed:", reason);
        } catch (bytes memory err) {
            console.log("Direct swap failed with bytes:");
            console.logBytes(err);
        }
    }
}
