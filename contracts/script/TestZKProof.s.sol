// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract TestZKProof is Script {
    address constant VERIFIER = 0xb2399B8008C644C2f1d6224112435138c3cDCC02;
    address constant HOOK = 0x5D39BEA27003bDa62B9EF3428cE22D62e9D26080;
    
    function run() external {
        console.log("=== Testing ZK Proof Verification ===");
        console.log("Verifier:", VERIFIER);
        console.log("Hook:", HOOK);
        
        // Use a REAL proof from browser - paste values here after generating
        // These are placeholders - you need actual proof values from snarkjs
        
        console.log("\nGenerate a proof in the browser with these inputs:");
        console.log("  amount_in: 1000000000000");
        console.log("  min_amount_out: 1");
        console.log("  batch_id: 1");
        console.log("  max_price_impact: 10000");
        console.log("  oracle_price: 200000000000");
        console.log("\nThen paste the pi_a, pi_b, pi_c values into this script and run:");
        console.log("  forge script script/TestZKProof.s.sol --rpc-url $SEPOLIA_RPC_URL");
    }
}
