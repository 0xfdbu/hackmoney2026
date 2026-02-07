// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract CheckCommitment is Script {
    function run() external view {
        uint256 amount = 1000000000000000; // 0.001 WETH
        uint256 minOut = 0;
        uint256 salt = 2516323843208679936;
        
        bytes32 commitment = keccak256(abi.encodePacked(amount, minOut, salt));
        console.log("Computed commitment:", vm.toString(commitment));
        console.log("Expected:          0x0f62c85ea8b3c623bf454a04604ff47cf5491ef315e2b0d1fa6029a9ac1637d4");
        
        // Verify encoding matches frontend
        bytes memory packed = abi.encodePacked(amount, minOut, salt);
        console.log("\nPacked encoding (should match frontend):");
        console.logBytes(packed);
    }
}
