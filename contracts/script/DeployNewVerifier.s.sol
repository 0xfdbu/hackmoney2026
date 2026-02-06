// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Groth16Verifier} from "../src/DarkPoolVerifier.sol";

contract DeployNewVerifierScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deploying new verifier from:", deployer);
        
        vm.startBroadcast(pk);
        
        Groth16Verifier verifier = new Groth16Verifier();
        
        vm.stopBroadcast();
        
        console.log("New verifier deployed at:", address(verifier));
    }
}