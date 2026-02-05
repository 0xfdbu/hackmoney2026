// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitPoolNewHookScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    // NEW HOOK
    address constant HOOK = 0xcA237Cd24c59F74A1391ab932FB22ED650B7611E;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(pk);
        
        // ETH/USDC pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        IPoolManager(POOL_MANAGER).initialize(poolKey, 79228162514264337593543950336);
        
        vm.stopBroadcast();
        
        console.log("Pool initialized!");
    }
}