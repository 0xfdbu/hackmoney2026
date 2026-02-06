// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitPoolCommitHook is Script {
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address hook = 0x30646e72c91705fff997af0FDe5b2f1fbFfB0080;
        
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        uint160 sqrtPriceX96 = 1771573796002276971027735586023;

        vm.startBroadcast();
        IPoolManager(poolManager).initialize(key, sqrtPriceX96);
        console.log("Pool initialized!");
        vm.stopBroadcast();
    }
}
