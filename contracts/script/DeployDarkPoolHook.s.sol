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
        address verifier = 0xa70cA69922e37ab774610dD905304892AE94472A;
        
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
        
        // Pre-computed salt for target 0x2080
        salt = bytes32(uint256(6928));
        hookAddress = vm.computeCreate2Address(salt, initCodeHash, CREATE2_DEPLOYER);
        console.log("Using pre-computed salt:", uint256(salt));
        console.log("Expected address:", hookAddress);
        console.log("Expected suffix:", uint160(hookAddress) & mask);

        vm.startBroadcast();
        DarkPoolHook hook = new DarkPoolHook{salt: salt}(IPoolManager(poolManager), verifier);
        console.log("DarkPoolHook deployed at:", address(hook));
        vm.stopBroadcast();
    }
}
