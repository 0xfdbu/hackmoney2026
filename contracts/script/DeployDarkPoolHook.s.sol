// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DeployDarkPoolHook is Script {
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    uint160 constant TARGET_FLAG = 0x04; // BEFORE_SWAP flag
    
    // CREATE2 Deployer (standard Foundry/DeterministicDeployer)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        console.log("Deploying DarkPoolHook...");
        console.log("Deployer:", deployer);
        console.log("Target: address ending in 0x04");

        // Prepare creation code with constructor args
        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(POOL_MANAGER, COMMIT_STORE);
        bytes memory fullBytecode = abi.encodePacked(creationCode, constructorArgs);
        
        // Mine for valid salt (off-chain computation, low gas)
        uint256 salt = _mineSalt(deployer, fullBytecode);
        address predicted = _computeAddress(salt, fullBytecode);
        
        console.log("Salt found:", salt);
        console.log("Predicted address:", predicted);
        require(uint160(predicted) & 0xF == TARGET_FLAG, "Wrong flag");

        // Deploy with CREATE2
        vm.startBroadcast(deployerKey);
        
        address hook;
        assembly {
            hook := create2(0, add(fullBytecode, 0x20), mload(fullBytecode), salt)
            if iszero(hook) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
        
        vm.stopBroadcast();
        
        console.log("\n=== DEPLOYED ===");
        console.log("Hook address:", hook);
        console.log("Update DarkPoolSwapScript.s.sol:");
        console.log(string.concat("address constant HOOK = ", vm.toString(hook), ";"));
    }
    
    // Mine off-chain (low gas, local computation)
    function _mineSalt(address deployer, bytes memory bytecode) internal view returns (uint256) {
        bytes32 initHash = keccak256(bytecode);
        
        for (uint256 salt; salt < 500000; salt++) {
            address addr = _computeAddressFromHash(salt, initHash);
            if (uint160(addr) & 0xF == TARGET_FLAG) {
                return salt;
            }
        }
        revert("Could not find valid salt in reasonable time");
    }
    
    function _computeAddress(uint256 salt, bytes memory bytecode) internal view returns (address) {
        bytes32 initHash = keccak256(bytecode);
        return _computeAddressFromHash(salt, initHash);
    }
    
    function _computeAddressFromHash(uint256 salt, bytes32 initHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            CREATE2_DEPLOYER,
            bytes32(salt),
            initHash
        )))));
    }
}