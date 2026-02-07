// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

/**
 * @title VerifyContracts
 * @notice This script helps verify contracts on Etherscan
 * @dev Run with: forge script script/VerifyContracts.s.sol --rpc-url $SEPOLIA_RPC_URL
 * 
 * To verify contracts, use these commands:
 * 
 * 1. Verify DarkPoolHook:
 * forge verify-contract \
 *   --chain-id 11155111 \
 *   --watch \
 *   --constructor-args $(cast abi-encode "constructor(address,address)" 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C) \
 *   0x1846217Bae61BF26612BD8d9a64b970d525B4080 \
 *   DarkPoolHook
 * 
 * 2. Verify SwapRouter:
 * forge verify-contract \
 *   --chain-id 11155111 \
 *   --watch \
 *   --constructor-args $(cast abi-encode "constructor(address,address,address)" 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C 0x1846217Bae61BF26612BD8d9a64b970d525B4080) \
 *   0x36b42E07273CD8ECfF1125bF15771AE356F085B1 \
 *   SwapRouter
 * 
 * 3. Verify CommitStore:
 * forge verify-contract \
 *   --chain-id 11155111 \
 *   --watch \
 *   0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C \
 *   CommitStore
 */
contract VerifyContracts is Script {
    function run() external {
        console.log("Contract Verification Helper");
        console.log("============================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  DarkPoolHook: 0x1846217Bae61BF26612BD8d9a64b970d525B4080");
        console.log("  SwapRouter:   0x36b42E07273CD8ECfF1125bF15771AE356F085B1");
        console.log("  CommitStore:  0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C");
        console.log("");
        console.log("Run the forge verify-contract commands from the comments above");
        console.log("Make sure ETHERSCAN_API_KEY is set in your .env");
    }
}
