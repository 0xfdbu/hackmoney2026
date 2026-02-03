// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Groth16Verifier} from "../src/Groth16Verifier.sol";

contract DeployVerifier is Script {
    function run() external {
        vm.startBroadcast();

        Groth16Verifier verifier = new Groth16Verifier();
        console.log("Groth16Verifier deployed at:", address(verifier));

        vm.stopBroadcast();
    }
}