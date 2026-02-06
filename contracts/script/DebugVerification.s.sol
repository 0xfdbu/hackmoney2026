// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract DebugVerification is Script {
    address constant VERIFIER = 0xc4bfe67D312F77b8488E70024d2f028B21eD103e;
    
    function run() external {
        console.log("=== Debug Verification ===");
        
        // Try with just the valid signal set to different values
        uint256[2] memory a = [uint256(1), uint256(2)];
        uint256[2][2] memory b = [[uint256(3), uint256(4)], [uint256(5), uint256(6)]];
        uint256[2] memory c = [uint256(7), uint256(8)];
        uint256[7] memory signals = [uint256(1), uint256(2), uint256(3), uint256(4), uint256(5), uint256(6), uint256(7)];
        
        console.log("Testing with dummy values...");
        (bool success, bytes memory returnData) = VERIFIER.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c, signals
            )
        );
        
        console.log("Success:", success);
        console.log("Return data length:", returnData.length);
        
        if (returnData.length > 0) {
            bool result = abi.decode(returnData, (bool));
            console.log("Result:", result);
        }
    }
}
