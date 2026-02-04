// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitializePool is Script {
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address hook = 0x830C433e3493b0B84A430103D95ea94a59A7eea0; // UPDATED HOOK
        
        address eth = 0x0000000000000000000000000000000000000000;
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(eth),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        vm.startBroadcast();
        
        IPoolManager(poolManager).initialize(key, sqrtPriceX96);
        
        console.log("Pool initialized with 1:1 price!");
        
        vm.stopBroadcast();
    }
}