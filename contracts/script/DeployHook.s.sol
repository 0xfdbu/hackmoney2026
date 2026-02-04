// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol"; // ← ADD THIS
import {PrivyFlowHook} from "../src/PrivyFlowHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployHook is Script {
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    // Hook bit positions in address
    uint160 constant BEFORE_INITIALIZE_FLAG = 1 << 159;
    uint160 constant AFTER_INITIALIZE_FLAG = 1 << 158;
    uint160 constant BEFORE_ADD_LIQUIDITY_FLAG = 1 << 157;
    uint160 constant AFTER_ADD_LIQUIDITY_FLAG = 1 << 156;
    uint160 constant BEFORE_REMOVE_LIQUIDITY_FLAG = 1 << 155;
    uint160 constant AFTER_REMOVE_LIQUIDITY_FLAG = 1 << 154;
    uint160 constant BEFORE_SWAP_FLAG = 1 << 153;
    uint160 constant AFTER_SWAP_FLAG = 1 << 152;
    
    // Mask for all permission bits (adjust if using return deltas)
    uint160 constant HOOK_PERMISSIONS_MASK = 0xFF << 152; // bits 152-159
    
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address verifier = 0x8524836d6c879286fC9aaF38e6a64209c51E4786;

        // ← FIX: Add BEFORE_INITIALIZE_FLAG if you want to initialize pools with this hook
        // Otherwise InitializePool.s.sol will fail with HookAddressNotValid
        uint160 flags = uint160(
            BEFORE_INITIALIZE_FLAG |  // Required for pool initialization
            BEFORE_SWAP_FLAG | 
            AFTER_SWAP_FLAG
        );

        bytes memory creationCode = type(PrivyFlowHook).creationCode;
        bytes memory constructorArgs = abi.encode(poolManager, verifier);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        bytes32 salt;
        address hookAddress;
        bool found = false;
        
        // Mine for salt
        for (uint256 i = 0; i < 10000000; i++) {
            salt = bytes32(i);
            hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
            
            // Skip if already deployed
            if (hookAddress.code.length > 0) continue;
            
            // ← FIX: Exact match check - ensure no extra hook bits are set
            if ((uint160(hookAddress) & HOOK_PERMISSIONS_MASK) == flags) {
                console.log("Found valid salt:", i);
                console.log("Hook Address will be:", hookAddress);
                found = true;
                break;
            }
        }

        require(found, "No valid salt found - try increasing range or adjusting flags");

        vm.startBroadcast();
        
        PrivyFlowHook hook = new PrivyFlowHook{salt: salt}(IPoolManager(poolManager), verifier);
        
        console.log("PrivyFlowHook deployed at:", address(hook));
        require(address(hook) == hookAddress, "Address mismatch");

        vm.stopBroadcast();
    }
}