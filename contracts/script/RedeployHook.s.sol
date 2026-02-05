// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract RedeployHookScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying hook from:", deployer);
        vm.startBroadcast(pk);
        
        // Deploy hook
        DarkPoolHook hook = new DarkPoolHook(IPoolManager(POOL_MANAGER), VERIFIER);
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", address(hook));
        console.log("Update HOOK_ADDRESS in frontend to:", address(hook));
    }
}