// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";

contract FindSalt is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        // Get the creation code from DarkPoolHook
        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(
            0xE03A1074c86CFeDd5C142C4F04F1a1536e203543, // poolManager
            0xa70cA69922e37ab774610dD905304892AE94472A  // verifier
        );
        bytes memory initCode = abi.encodePacked(creationCode, constructorArgs);
        bytes32 initCodeHash = keccak256(initCode);
        
        console.log("Init code hash:");
        console.logBytes32(initCodeHash);
        
        // Target: 0x2080 (beforeInitialize + beforeSwap)
        uint160 target = 0x2080;
        uint160 mask = 0x3FFF;
        
        console.log("Searching for salt...");
        
        bytes32 salt;
        address hookAddress;
        
        for (uint256 i = 0; i < 20000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            if ((uint160(hookAddress) & mask) == target) {
                console.log("Found salt:", i);
                console.log("Address:", hookAddress);
                console.log("Suffix:", uint160(hookAddress) & mask);
                break;
            }
            
            if (i % 100000 == 0) {
                console.log("Checked:", i);
            }
        }
    }
}
