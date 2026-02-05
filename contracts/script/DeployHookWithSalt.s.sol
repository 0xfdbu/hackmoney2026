// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployHookWithSaltScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
    
    // Target prefix: 0x82 (beforeInitialize + beforeSwap)
    // Hook permissions: beforeInitialize (bit 159) + beforeSwap (bit 153)
    // 0x82 = 1000 0010 = bits 7 and 1 set
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying hook from:", deployer);
        
        // Try different salts to find one with correct prefix
        bytes32 salt = bytes32(0);
        address hookAddress;
        uint256 nonce = 0;
        
        // Expected permissions prefix
        // beforeInitialize: true -> bit 159 = 1
        // beforeSwap: true -> bit 153 = 1
        // prefix should be 0x82
        
        vm.startBroadcast(pk);
        
        // Just deploy without salt mining for now - using CREATE
        DarkPoolHook hook = new DarkPoolHook(IPoolManager(POOL_MANAGER), VERIFIER);
        hookAddress = address(hook);
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", hookAddress);
        
        // Check if address is valid
        try this.validateHookAddress(hookAddress) {
            console.log("Hook address is VALID!");
        } catch {
            console.log("Hook address is INVALID - need to mine salt");
            console.log("Expected prefix: 0x82");
            console.log("Actual prefix:", uint160(hookAddress) >> 152);
        }
    }
    
    function validateHookAddress(address hook) external pure {
        require(uint160(hook) & 0xFF == 0x82, "Invalid hook prefix");
    }
}