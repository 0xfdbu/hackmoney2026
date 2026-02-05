// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployDarkPoolHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address verifier = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
        
        // Uniswap v4 uses the LEAST SIGNIFICANT 14 bits for hook permissions
        // BEFORE_INITIALIZE_FLAG = 1 << 13 = 0x2000
        // BEFORE_SWAP_FLAG = 1 << 7 = 0x0080
        // Target: 0x2000 | 0x0080 = 0x2080
        uint160 target = 0x2080;
        uint160 mask = 0x3FFF; // 14 bits

        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(poolManager, verifier);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        bytes32 salt;
        address hookAddress;
        bool found = false;
        
        console.log("Mining for hook address ending in 0x2080 (beforeInitialize + beforeSwap)...");
        
        for (uint256 i = 0; i < 10000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            if (address(hookAddress).code.length > 0) continue;
            
            if ((uint160(hookAddress) & mask) == target) {
                console.log("Found salt:", i);
                console.log("Address:", hookAddress);
                console.log("Suffix:", uint160(hookAddress) & mask);
                found = true;
                break;
            }
            
            if (i % 100000 == 0 && i > 0) {
                console.log("Checked:", i);
            }
        }

        require(found, "No valid salt found");

        vm.startBroadcast();
        DarkPoolHook hook = new DarkPoolHook{salt: salt}(IPoolManager(poolManager), verifier);
        console.log("DarkPoolHook deployed at:", address(hook));
        vm.stopBroadcast();
    }
}
