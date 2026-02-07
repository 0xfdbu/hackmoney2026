// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract VerifyCommitment is Script {
    function run() external view {
        uint256 amount = 100000000000000; // 0.0001 WETH
        uint256 minOut = 0;
        uint256 salt = 968714857077782; // 0x221edc48930e16
        
        bytes32 commitment = keccak256(abi.encodePacked(amount, minOut, salt));
        
        console.log("Expected commitment:", vm.toString(commitment));
        console.log("Provided commitment: 0x27a850bceaa2ae6c0664feb317e16f5cd2209d215921e86f8d7338c0fe09553a");
        console.log("Match:", uint256(commitment) == uint256(0x27a850bceaa2ae6c0664feb317e16f5cd2209d215921e86f8d7338c0fe09553a));
    }
}
