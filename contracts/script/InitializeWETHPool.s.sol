// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitializeWETHPoolScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0xca3656933c53642BcEEBfD40F0b5D5D3ABCFc3E5;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Initializing WETH/USDC pool from:", deployer);
        
        vm.startBroadcast(pk);
        
        // Initialize WETH/USDC pool (USDC < WETH by address)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // Price = 1.0
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        IPoolManager(POOL_MANAGER).initialize(poolKey, sqrtPriceX96);
        
        vm.stopBroadcast();
        
        console.log("WETH/USDC Pool initialized!");
    }
}