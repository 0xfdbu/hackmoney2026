// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract MineHookAddressV2Script is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Mining hook address from:", deployer);
        
        // Target prefix: 0xCA (like original hook)
        uint256 targetPrefix = 0xCA;
        
        bytes memory creationCode = abi.encodePacked(
            type(DarkPoolHook).creationCode,
            abi.encode(POOL_MANAGER, VERIFIER)
        );
        
        uint256 salt = 0;
        address predicted;
        
        // Mine for salt with 0xCA prefix
        while (true) {
            predicted = vm.computeCreate2Address(
                bytes32(salt),
                keccak256(creationCode),
                CREATE2_DEPLOYER
            );
            
            // Check if address has correct prefix
            if (uint160(predicted) >> 152 == targetPrefix) {
                console.log("Found valid salt:", salt);
                console.log("Predicted address:", predicted);
                break;
            }
            
            salt++;
            
            if (salt % 100000 == 0) {
                console.log("Tried", salt, "salts...");
            }
            
            if (salt > 10000000) {
                console.log("Gave up after 10M attempts");
                return;
            }
        }
    }
}