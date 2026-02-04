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
        address hook = 0x80155F48AeADFB2cf5B27577c48A61e04F66BFde;
        
        // Note: ETH must be currency0 (lower address)
        // 0x0000... < 0x1c7D..., so this is correct
        address eth = 0x0000000000000000000000000000000000000000;
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(eth),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        // Use a valid uint160 value for initial price
        // This value (79228162514264337593543950336) is 2^96, representing price = 1
        // For ETH/USDC, this means 1 ETH = 1 USDC (not realistic, but valid for testing)
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        vm.startBroadcast();
        
        IPoolManager(poolManager).initialize(key, sqrtPriceX96);
        
        console.log("Pool initialized with 1:1 price!");
        
        vm.stopBroadcast();
    }
}