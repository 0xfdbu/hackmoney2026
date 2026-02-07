// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract DebugAmounts is Script {
    function run() external view {
        // Failed swap
        uint256 failedAmount = 10000000000000; // From failed tx
        uint256 successAmount = 1000000000000000; // From success tx
        
        console.log("Failed amount:", failedAmount);
        console.log("  In WETH:", failedAmount / 1e18);
        console.log("  In wei:", failedAmount);
        
        console.log("\nSuccess amount:", successAmount);
        console.log("  In WETH:", successAmount / 1e18);
        console.log("  In wei:", successAmount);
        
        // Check if the commitment would match
        uint256 salt = 3519455427183320064;
        uint256 minOut = 0;
        
        bytes32 failedCommitment = keccak256(abi.encodePacked(failedAmount, minOut, salt));
        console.log("\nFailed commitment would be:", vm.toString(failedCommitment));
        
        bytes32 successCommitment = keccak256(abi.encodePacked(successAmount, minOut, salt));
        console.log("Success commitment would be:", vm.toString(successCommitment));
        
        // Check what's in the failed tx hookData
        bytes32 actualCommitment = 0xf4d29b242344abe31f1d5013e76d34f3ee61ede587ee5aa43100c5a98ceb9462;
        console.log("\nActual commitment from failed tx:", vm.toString(actualCommitment));
        console.log("Matches failed:", failedCommitment == actualCommitment);
        console.log("Matches success:", successCommitment == actualCommitment);
    }
}
