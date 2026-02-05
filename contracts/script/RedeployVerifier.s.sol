// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Groth16Verifier as DarkPoolVerifier} from "../src/DarkPoolVerifier.sol";

contract RedeployVerifierScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying verifier from:", deployer);
        
        vm.startBroadcast(pk);
        
        DarkPoolVerifier verifier = new DarkPoolVerifier();
        
        vm.stopBroadcast();
        
        console.log("Verifier deployed at:", address(verifier));
        console.log("Update VERIFIER_ADDRESS in constants to:", address(verifier));
    }
}