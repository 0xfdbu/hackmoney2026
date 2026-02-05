// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract MineHookAddressScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Mining hook address from:", deployer);
        
        // Get the expected prefix from hook permissions
        // Original hook: 0xCAC28E99c67B2f54A92f602046136899dA296080
        // Prefix: 0xCA
        
        // For DarkPoolHook permissions:
        // beforeInitialize: true -> bit 159
        // beforeSwap: true -> bit 153
        // Required prefix: 0x82 (1000 0010)
        
        bytes memory creationCode = abi.encodePacked(
            type(DarkPoolHook).creationCode,
            abi.encode(POOL_MANAGER, VERIFIER)
        );
        
        uint256 salt = 0;
        address predicted;
        
        // Mine for salt
        while (true) {
            predicted = vm.computeCreate2Address(
                bytes32(salt),
                keccak256(creationCode),
                CREATE2_DEPLOYER
            );
            
            // Check if address has correct prefix (first byte should be 0x82)
            if (uint160(predicted) >> 152 == 0x82) {
                console.log("Found valid salt:", salt);
                console.log("Predicted address:", predicted);
                break;
            }
            
            salt++;
            
            if (salt % 10000 == 0) {
                console.log("Tried", salt, "salts...");
            }
            
            if (salt > 1000000) {
                console.log("Gave up after 1M attempts");
                return;
            }
        }
    }
}