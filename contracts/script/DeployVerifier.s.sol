// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {Groth16Verifier} from "../src/DarkPoolVerifier.sol";

contract DeployVerifier is Script {
    function run() external {
        vm.startBroadcast();
        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier deployed at:", address(verifier));
        vm.stopBroadcast();
    }
}
