// script/DeployFixedRouter.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import "../src/SwapRouter.sol";

contract Deploy is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        SwapRouter router = new SwapRouter(IPoolManager(POOL_MANAGER));
        
        vm.stopBroadcast();
        
        console.log("Fixed SwapRouter deployed:", address(router));
        console.log("Update ROUTER_ADDRESS in your frontend constants!");
    }
}