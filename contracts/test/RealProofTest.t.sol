// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";

contract RealProofTest is Test {
    address constant VERIFIER = 0xc4bfe67D312F77b8488E70024d2f028B21eD103e;
    address constant HOOK = 0x3bF3AC501FdF6DE1A08e795cC5722b78a611e080;
    
    function setUp() public {
        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/DFCXUzLyQhp00HIXt2NTo");
    }
    
    function testOriginalSignalOrder() public view {
        // FRESH PROOF from snarkjs
        uint256[2] memory a = [
            11609564415724853034419450650815427268891337242322978396807053345782589373696,
            16361470067510589106977907297011702978225554100753127321881610382437392598794
        ];
        
        uint256[2][2] memory b = [
            [
                7749040274252958025173268815418201621654537586404334577724487937916282775420,
                8985648792984657405819859826313176981196217307008036698283655081582755421741
            ],
            [
                18328130586283664996398902313462678831804371129516066631975501348972341433048,
                13881050112530180123881961406917304806079564490835131205469176579348634622120
            ]
        ];
        
        uint256[2] memory c = [
            7238302260638527072224446170363892507722524880496193975743482698772517740936,
            9672733582736525090582542746366377292859987991974323754099850465276411893592
        ];
        
        // SNARKJS ORDER (from fullProve output):
        // [commitment, nullifier, batch_id, valid, batch_id_out, max_price_impact, oracle_price]
        uint256[7] memory signals = [
            13468043774493541282573903797802325966421488021005027815126650173264005873332,
            14969509321192296083583858150834406960669382495771853255563273696969058906816,
            1,
            1,
            1,
            10000,
            200000000000
        ];
        
        console.log("=== TESTING SNARKJS NATIVE ORDER ===");
        console.log("Verifier:", VERIFIER);
        console.log("\nSignals (snarkjs order - NO reordering):");
        console.log("  [0] commitment:", signals[0]);
        console.log("  [1] nullifier:", signals[1]);
        console.log("  [2] batch_id:", signals[2]);
        console.log("  [3] valid:", signals[3]);
        console.log("  [4] batch_id_out:", signals[4]);
        console.log("  [5] max_price_impact:", signals[5]);
        console.log("  [6] oracle_price:", signals[6]);
        
        // Call verifier WITHOUT reordering
        console.log("\n=== CALLING VERIFIER ===");
        (bool success, bytes memory returnData) = VERIFIER.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c, signals
            )
        );
        
        console.log("Call success:", success);
        console.log("Return data length:", returnData.length);
        
        if (returnData.length > 0) {
            bool result = abi.decode(returnData, (bool));
            console.log("VERIFICATION RESULT:", result);
            
            if (result) {
                console.log("\n*** SUCCESS! SNARKJS ORDER WORKS! ***");
            } else {
                console.log("\n*** FAILED - Need to try different order ***");
            }
        } else {
            console.log("No return data - verifier reverted");
        }
    }
}
