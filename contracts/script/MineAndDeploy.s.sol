// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract MineAndDeployScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0x160Ee86f4Fd0b7d22B45fcDe439359ed4f4629C1;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Mining hook address from:", deployer);
        
        uint256 targetPrefix = 0xCA;
        
        bytes memory creationCode = abi.encodePacked(
            type(DarkPoolHook).creationCode,
            abi.encode(POOL_MANAGER, VERIFIER)
        );
        
        uint256 salt = 1000; // Start from 1000
        address predicted;
        
        while (true) {
            predicted = vm.computeCreate2Address(
                bytes32(salt),
                keccak256(creationCode),
                CREATE2_DEPLOYER
            );
            
            if (uint160(predicted) >> 152 == targetPrefix) {
                console.log("Found valid salt:", salt);
                console.log("Predicted address:", predicted);
                break;
            }
            
            salt++;
            
            if (salt % 100000 == 0) {
                console.log("Tried", salt, "salts...");
            }
            
            if (salt > 2000000) {
                console.log("Gave up after 2M attempts");
                return;
            }
        }
        
        // Deploy
        vm.startBroadcast(pk);
        
        (bool success, ) = CREATE2_DEPLOYER.call(
            abi.encodePacked(bytes32(salt), creationCode)
        );
        
        require(success, "CREATE2 deployment failed");
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", predicted);
    }
}