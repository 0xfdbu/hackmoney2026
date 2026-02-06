// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitPool is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    // Starting at 1:1 price
    uint160 constant STARTING_SQRT_PRICE = 79228162514264337593543950336;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        
        Currency c0 = Currency.wrap(USDC);
        Currency c1 = Currency.wrap(WETH);
        
        PoolKey memory key = PoolKey({
            currency0: c0, 
            currency1: c1, 
            fee: 3000, 
            tickSpacing: 60, 
            hooks: IHooks(HOOK)
        });
        
        vm.startBroadcast(pk);
        
        try IPoolManager(POOL_MANAGER).initialize(key, STARTING_SQRT_PRICE) {
            console.log("Pool initialized!");
        } catch Error(string memory r) {
            console.log("Failed:", r);
        } catch (bytes memory r) {
            console.log("Failed with bytes");
            console.logBytes(r);
        }
        
        vm.stopBroadcast();
    }
}
