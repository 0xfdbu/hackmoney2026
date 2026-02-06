// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";

contract QuickFindSalt is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            0xE03A1074c86CFeDd5C142C4F04F1a1536e203543,
            0x0fd9c5aF93935fD91d355Ad7cbbf36712e368f71
        );
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);
        
        uint160 target = 0x2080;
        uint160 mask = 0x3FFF;
        
        bytes32 salt;
        address hookAddress;
        
        // Search for a valid salt
        console.log("Searching...");
        for (uint256 i = 0; i < 2000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            if ((uint160(hookAddress) & mask) == target) {
                console.log("Found salt:", i);
                console.log("Address:", hookAddress);
                return;
            }
            
            if (i % 10000 == 0) {
                console.log("Checked:", i);
            }
        }
        console.log("No salt found in range");
    }
}
