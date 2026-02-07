// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitializePoolScript is Script {
    // Use FEE = 10000 (1%) to avoid broken pools
    uint24 constant FEE = 10000;
    int24 constant TICK_SPACING = 200; // 10000 fee uses 200 tick spacing
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;

    function run() external {
        vm.startBroadcast();
        
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        // Proper starting price: 1 WETH = 2000 USDC
        uint160 startingPrice = 2505413461900723139654726429188;
        
        console.log("Initializing new pool with:");
        console.log("  Fee:", FEE, "(1%)");
        console.log("  TickSpacing:", TICK_SPACING);
        console.log("  sqrtPriceX96:", startingPrice);
        
        try poolManager.initialize(poolKey, startingPrice) {
            console.log("Pool initialized successfully!");
        } catch (bytes memory err) {
            if (err.length >= 4) {
                bytes4 selector;
                assembly { selector := mload(add(err, 32)) }
                if (selector == 0x7983c051) {
                    console.log("Pool already exists with these params");
                } else {
                    console.log("Error:", vm.toString(selector));
                }
            }
        }
        
        vm.stopBroadcast();
    }
}