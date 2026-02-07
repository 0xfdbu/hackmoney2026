// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract CompareSwaps is Script {
    function run() external view {
        // Frontend params (failed)
        uint256 frontendSalt = 8908001854157713408;
        uint256 frontendAmount = 1000000;
        uint256 frontendMinOut = 0;
        bytes32 frontendCommitment = keccak256(abi.encodePacked(frontendAmount, frontendMinOut, frontendSalt));
        
        console.log("Frontend (failed):");
        console.log("  Salt:", frontendSalt);
        console.log("  Amount:", frontendAmount);
        console.log("  MinOut:", frontendMinOut);
        console.log("  Commitment:", vm.toString(frontendCommitment));
        console.log("  Hook data encoding:");
        console.logBytes(abi.encode(frontendCommitment, frontendSalt, frontendMinOut));
        
        // Foundry params (worked)
        uint256 foundrySalt = 48208200747286979484880102624422250187739261721973404144477334400866962567443;
        uint256 foundryAmount = 1000000;
        uint256 foundryMinOut = 0;
        bytes32 foundryCommitment = keccak256(abi.encodePacked(foundryAmount, foundryMinOut, foundrySalt));
        
        console.log("\nFoundry (worked):");
        console.log("  Salt:", foundrySalt);
        console.log("  Amount:", foundryAmount);
        console.log("  MinOut:", foundryMinOut);
        console.log("  Commitment:", vm.toString(foundryCommitment));
        console.log("  Hook data encoding:");
        console.logBytes(abi.encode(foundryCommitment, foundrySalt, foundryMinOut));
    }
}
