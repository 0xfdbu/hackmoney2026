// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {DarkPoolHook} from "../src/DarkPoolHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployHookWithNewSaltScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    // NEW VERIFIER ADDRESS
    address constant VERIFIER = 0x160Ee86f4Fd0b7d22B45fcDe439359ed4f4629C1;
    address constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    
    // New salt (old was 359)
    bytes32 constant SALT = bytes32(uint256(360));
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying hook from:", deployer);
        console.log("New verifier:", VERIFIER);
        
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
        
        vm.startBroadcast(pk);
        
        (bool success, ) = CREATE2_DEPLOYER.call(
            abi.encodePacked(SALT, creationCode)
        );
        
        require(success, "CREATE2 deployment failed");
        
        vm.stopBroadcast();
        
        console.log("Hook deployed at:", predicted);
    }
}