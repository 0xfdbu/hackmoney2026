// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract DebugFrontend is Script {
    function run() external view {
        // From the failed transaction
        bytes32 providedCommitment = 0x27a850bceaa2ae6c0664feb317e16f5cd2209d215921e86f8d7338c0fe09553a;
        uint256 saltFromTx = 9604080667397654; // 0x221edc48930e16
        
        // The amount from the tx
        uint256 amount = 100000000000000; // 0.0001 WETH
        uint256 minOut = 0;
        
        // What the commitment should be
        bytes32 expectedCommitment = keccak256(abi.encodePacked(amount, minOut, saltFromTx));
        
        console.log("Amount:", amount);
        console.log("Salt from TX:", saltFromTx);
        console.log("Provided commitment:", vm.toString(providedCommitment));
        console.log("Expected commitment:", vm.toString(expectedCommitment));
        console.log("Match:", providedCommitment == expectedCommitment);
    }
}
