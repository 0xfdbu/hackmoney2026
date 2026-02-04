// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {PrivyFlowHook} from "../src/PrivyFlowHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployHook is Script {
    function run() external {
        // FIXED: Correct Checksummed Address for Sepolia
        address poolManager = 0x99C29E2D4F2f8a9f9E2A1f962Dd659C5e8f5e7d3; 
        address verifier = 0x8524836d6c879286fC9aaF38e6a64209c51E4786;

        // 0x80 | 0x40 = 0xC0 (Required prefix for BeforeSwap + AfterSwap)
        uint160 flags = uint160(Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG);

        vm.startBroadcast();

        // Mining Loop: Find a salt that produces an address starting with 0xC0...
        bytes32 salt;
        address hookAddress;
        bytes32 initCodeHash = keccak256(
            abi.encodePacked(type(PrivyFlowHook).creationCode, abi.encode(poolManager, verifier))
        );

        for (uint256 i = 0; i < 5000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash);
            
            // Check if the address matches the flags
            if (uint160(hookAddress) & flags == flags) {
                console.log("Found valid salt:", i);
                console.log("Hook Address will be:", hookAddress);
                break;
            }
        }

        require(uint160(hookAddress) & flags == flags, "Mining failed. Increase loop count.");

        // Deploy using CREATE2 with the mined salt
        PrivyFlowHook hook = new PrivyFlowHook{salt: salt}(IPoolManager(poolManager), verifier);
        
        console.log("PrivyFlowHook deployed successfully at:", address(hook));

        vm.stopBroadcast();
    }
}