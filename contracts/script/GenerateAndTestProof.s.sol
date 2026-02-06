// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";

contract GenerateAndTestProof is Script {
    address constant VERIFIER = 0x0fd9c5aF93935fD91d355Ad7cbbf36712e368f71;
    address constant HOOK = 0x67870c6e95C0c66F9D02ce73DD7850784AbDe080;
    
    function run() external {
        console.log("=== ZK Proof Debugger ===");
        console.log("Chain:", block.chainid);
        console.log("Verifier:", VERIFIER);
        console.log("Hook:", HOOK);
        
        // Step 1: Check contracts exist
        console.log("\n1. Checking contracts...");
        console.log("  Verifier code size:", VERIFIER.code.length);
        console.log("  Hook code size:", HOOK.code.length);
        
        // Step 2: Test verifier signature
        console.log("\n2. Testing verifier signature...");
        _testVerifierSignature();
        
        // Step 3: Test with sample data
        console.log("\n3. Testing with sample proof data...");
        _testWithSampleData();
        
        // Step 4: Check verification key matches
        console.log("\n4. Checking verification key...");
        _checkVerificationKey();
    }
    
    function _testVerifierSignature() internal {
        // Try to get the verifier's verifyProof selector
        bytes4 selector = bytes4(keccak256("verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])"));
        console.log("  Expected selector:");
        console.logBytes4(selector);
        
        // Check if verifier has this function
        (bool success, ) = VERIFIER.staticcall(
            abi.encodeWithSelector(selector)
        );
        console.log("  Selector recognized:", success);
    }
    
    function _testWithSampleData() internal {
        // These are sample values - replace with actual proof from your browser
        uint256[2] memory a = [
            13468043774493541282573903797802325966421488021005027815126650173264005873332,
            14969509321192296083583858150834406960669382495771853255563273696969058906816
        ];
        
        uint256[2][2] memory b = [
            [
                13468043774493541282573903797802325966421488021005027815126650173264005873332,
                14969509321192296083583858150834406960669382495771853255563273696969058906816
            ],
            [
                13468043774493541282573903797802325966421488021005027815126650173264005873332,
                14969509321192296083583858150834406960669382495771853255563273696969058906816
            ]
        ];
        
        uint256[2] memory c = [
            13468043774493541282573903797802325966421488021005027815126650173264005873332,
            14969509321192296083583858150834406960669382495771853255563273696969058906816
        ];
        
        // Signals in CIRCUIT ORDER (what snarkjs outputs):
        // [commitment, nullifier, batch_id, valid, batch_id_out, max_price_impact, oracle_price]
        uint256[7] memory circuitSignals = [
            13468043774493541282573903797802325966421488021005027815126650173264005873332, // commitment
            14969509321192296083583858150834406960669382495771853255563273696969058906816, // nullifier
            1,      // batch_id
            1,      // valid (should be 1)
            1,      // batch_id_out
            10000,  // max_price_impact
            200000000000 // oracle_price
        ];
        
        console.log("  Circuit signals:");
        for (uint i = 0; i < 7; i++) {
            console.log("    [%s]: %s", i, circuitSignals[i]);
        }
        
        // Reorder to VERIFIER ORDER:
        // [batch_id, max_price_impact, oracle_price, commitment, nullifier, batch_id_out, valid]
        uint256[7] memory verifierSignals;
        verifierSignals[0] = circuitSignals[2]; // batch_id
        verifierSignals[1] = circuitSignals[5]; // max_price_impact
        verifierSignals[2] = circuitSignals[6]; // oracle_price
        verifierSignals[3] = circuitSignals[0]; // commitment
        verifierSignals[4] = circuitSignals[1]; // nullifier
        verifierSignals[5] = circuitSignals[4]; // batch_id_out
        verifierSignals[6] = circuitSignals[3]; // valid
        
        console.log("\n  Verifier signals (reordered):");
        for (uint i = 0; i < 7; i++) {
            console.log("    [%s]: %s", i, verifierSignals[i]);
        }
        
        // Call verifier
        console.log("\n  Calling verifier...");
        (bool success, bytes memory returnData) = VERIFIER.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c, verifierSignals
            )
        );
        
        console.log("  Call success:", success);
        if (returnData.length > 0) {
            bool result = abi.decode(returnData, (bool));
            console.log("  Verification result:", result);
        } else {
            console.log("  No return data - call reverted or failed");
        }
    }
    
    function _checkVerificationKey() internal {
        // Try to extract verification key hash from verifier
        // This is a hack but might work
        console.log("  Checking if vk matches circuit...");
        
        // The verifier contract stores vk in constants
        // We can't easily read them but we can infer from behavior
        console.log("  (Compare local verification_key.json with deployed verifier)");
    }
}
