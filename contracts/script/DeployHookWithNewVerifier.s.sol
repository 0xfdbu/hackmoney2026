// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployHookWithNewVerifierScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    // NEW VERIFIER with 7 signals
    address constant VERIFIER = 0xa70cA69922e37ab774610dD905304892AE94472A;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying hook from:", deployer);
        
        bytes memory creationCode = abi.encodePacked(
            type(DarkPoolHook).creationCode,
            abi.encode(POOL_MANAGER, VERIFIER)
        );
        
        // Mine for 0xCA prefix
        uint256 salt = 2000;
        address predicted;
        
        while (true) {
            predicted = vm.computeCreate2Address(
                bytes32(salt),
                keccak256(creationCode),
                CREATE2_DEPLOYER
            );
            
            if (uint160(predicted) >> 152 == 0xCA) {
                console.log("Found salt:", salt);
                console.log("Address:", predicted);
                break;
            }
            
            salt++;
            if (salt > 10000) {
                console.log("No valid salt found");
                return;
            }
        }
        
        vm.startBroadcast(pk);
        
        (bool success, ) = CREATE2_DEPLOYER.call(
            abi.encodePacked(bytes32(salt), creationCode)
        );
        
        require(success, "Deploy failed");
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", predicted);
    }
}