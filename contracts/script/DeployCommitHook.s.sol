// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployCommitHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        
        // Need beforeSwap permission: 1 << 7 = 0x0080
        uint160 target = 0x0080;
        uint160 mask = 0x3FFF;

        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(poolManager);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        bytes32 salt;
        address hookAddress;
        
        // Mine for salt
        for (uint256 i = 0; i < 5000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            if ((uint160(hookAddress) & mask) == target) {
                console.log("Found salt:", i);
                console.log("Hook address:", hookAddress);
                break;
            }
            
            if (i % 100000 == 0) {
                console.log("Mining... checked:", i);
            }
        }
        
        require((uint160(hookAddress) & mask) == target, "No valid salt found");

        vm.startBroadcast();
        DarkPoolHook hook = new DarkPoolHook{salt: salt}(IPoolManager(poolManager));
        console.log("DarkPoolHook deployed at:", address(hook));
        vm.stopBroadcast();
    }
}
