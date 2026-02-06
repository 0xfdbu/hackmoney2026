// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";

contract InitPoolWithNewHook is Script {
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address hook = 0xD2528A51f7589c11490f3DeA7Fe1a21F9739e080;
        
        // ETH/USDC pool
        address currency0 = address(0); // ETH as native
        address currency1 = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238; // USDC
        
        uint24 fee = 3000;
        int24 tickSpacing = 60;
        
        // Starting price: 1 ETH = 2000 USDC
        // sqrtPriceX96 = sqrt(2000) * 2^96
        uint160 sqrtPriceX96 = 1771573796002276971027735586023;

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(currency0),
            currency1: Currency.wrap(currency1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: IHooks(hook)
        });

        vm.startBroadcast();
        
        try IPoolManager(poolManager).initialize(key, sqrtPriceX96) {
            console.log("Pool initialized successfully!");
        } catch Error(string memory reason) {
            console.log("Failed to initialize pool:", reason);
        } catch {
            console.log("Failed to initialize pool (unknown error)");
        }
        
        vm.stopBroadcast();
    }
}
