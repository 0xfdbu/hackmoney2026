// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployHookFinalScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant VERIFIER = 0xE61bFE404E7c4Ee766E3e99f66F33236b7E02981;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    bytes32 constant SALT = bytes32(uint256(359));
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying hook from:", deployer);
        console.log("Using salt:", uint256(SALT));
        
        bytes memory creationCode = abi.encodePacked(
            type(DarkPoolHook).creationCode,
            abi.encode(POOL_MANAGER, VERIFIER)
        );
        
        address predicted = vm.computeCreate2Address(
            SALT,
            keccak256(creationCode),
            CREATE2_DEPLOYER
        );
        
        console.log("Predicted address:", predicted);
        console.log("Prefix check:", uint160(predicted) >> 152);
        
        vm.startBroadcast(pk);
        
        // Deploy using CREATE2 deployer
        (bool success, ) = CREATE2_DEPLOYER.call(
            abi.encodePacked(SALT, creationCode)
        );
        
        require(success, "CREATE2 deployment failed");
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", predicted);
        console.log("Update HOOK_ADDRESS to:", predicted);
    }
}