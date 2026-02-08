// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {CommitStore} from "../src/CommitStore.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {SwapRouter} from "../src/SwapRouter.sol";

contract DeployPrivyFlow is Script {
    // Sepolia addresses
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    uint160 constant TARGET_FLAG = 0x04; // BEFORE_SWAP flag
    
    // Standard CREATE2 deployer (used for address computation)
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        console.log("=== PrivyFlow Deployment ===");
        console.log("Deployer:", deployer);
        console.log("PoolManager:", POOL_MANAGER);

        vm.startBroadcast(deployerKey);
        
        // 1. Deploy CommitStore first (needed for hook constructor)
        CommitStore commitStore = new CommitStore();
        console.log("CommitStore deployed:", address(commitStore));
        
        // 2. Deploy DarkPoolHook with CREATE2 mining for address ending in 0x04
        address hook = _deployMinedHook(deployer, address(commitStore));
        console.log("DarkPoolHook deployed:", hook);
        require(uint160(hook) & 0xF == TARGET_FLAG, "Hook missing BEFORE_SWAP flag");
        
        // 3. Deploy SwapRouter
        SwapRouter router = new SwapRouter(IPoolManager(POOL_MANAGER));
        console.log("SwapRouter deployed:", address(router));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("CommitStore:  ", address(commitStore));
        console.log("DarkPoolHook: ", hook);
        console.log("SwapRouter:   ", address(router));
        console.log("\nUpdate contracts/constants.ts with these addresses.");
    }
    
    /// @notice Deploy hook using CREATE2 with mined salt for required address flags
    function _deployMinedHook(address deployer, address commitStore) internal returns (address) {
        bytes memory creationCode = type(DarkPoolHook).creationCode;
        bytes memory constructorArgs = abi.encode(POOL_MANAGER, commitStore);
        bytes memory fullBytecode = abi.encodePacked(creationCode, constructorArgs);
        
        // Mine salt locally (no gas cost)
        console.log("Mining for salt (this may take a moment)...");
        uint256 salt = _mineSalt(deployer, fullBytecode);
        address predicted = _computeAddress(salt, fullBytecode);
        
        console.log("Salt found:", salt);
        console.log("Predicted address:", predicted);

        // Deploy using CREATE2 opcode
        address hook;
        assembly {
            hook := create2(0, add(fullBytecode, 0x20), mload(fullBytecode), salt)
            if iszero(hook) {
                returndatacopy(0, 0, returndatasize())
                revert(0, returndatasize())
            }
        }
        
        return hook;
    }
    
    /// @notice Find salt that produces address ending in TARGET_FLAG (0x04)
    function _mineSalt(address deployer, bytes memory bytecode) internal view returns (uint256) {
        bytes32 initHash = keccak256(bytecode);
        
        for (uint256 salt; salt < 5000000; salt++) {
            address addr = _computeAddressFromHash(salt, initHash);
            if (uint160(addr) & 0xF == TARGET_FLAG) {
                return salt;
            }
        }
        revert("Could not find valid salt - increase search range");
    }
    
    function _computeAddress(uint256 salt, bytes memory bytecode) internal view returns (address) {
        return _computeAddressFromHash(salt, keccak256(bytecode));
    }
    
    /// @notice Compute CREATE2 address using standard deployer formula
    function _computeAddressFromHash(uint256 salt, bytes32 initHash) internal pure returns (address) {
        return address(uint160(uint256(keccak256(abi.encodePacked(
            bytes1(0xff),
            CREATE2_DEPLOYER,
            bytes32(salt),
            initHash
        )))));
    }
}