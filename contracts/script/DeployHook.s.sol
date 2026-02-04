// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {PrivyFlowHook} from "../src/PrivyFlowHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address verifier = 0x8524836d6c879286fC9aaF38e6a64209c51E4786;

        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        bytes memory creationCode = type(PrivyFlowHook).creationCode;
        bytes memory constructorArgs = abi.encode(poolManager, verifier);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        bytes32 salt;
        address hookAddress;
        bool found = false;
        
        // Mine for salt, skip if address already has code
        for (uint256 i = 0; i < 10000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            // Skip if address already has code (already deployed)
            if (hookAddress.code.length > 0) {
                continue;
            }
            
            // Check if flags match
            if (uint160(hookAddress) & flags == flags) {
                console.log("Found valid salt:", i);
                console.log("Hook Address will be:", hookAddress);
                found = true;
                break;
            }
        }

        require(found, "No valid salt found");

        vm.startBroadcast();
        
        PrivyFlowHook hook = new PrivyFlowHook{salt: salt}(IPoolManager(poolManager), verifier);
        
        console.log("PrivyFlowHook deployed at:", address(hook));
        require(address(hook) == hookAddress, "Address mismatch");

        vm.stopBroadcast();
    }
}