// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "forge-std/console.sol";

contract FindSignalOrder is Test {
    address constant VERIFIER = 0xc4bfe67D312F77b8488E70024d2f028B21eD103e;
    
    // FRESH PROOF from snarkjs
    uint256[2] a = [
        11609564415724853034419450650815427268891337242322978396807053345782589373696,
        16361470067510589106977907297011702978225554100753127321881610382437392598794
    ];
    
    uint256[2][2] b = [
        [
            7749040274252958025173268815418201621654537586404334577724487937916282775420,
            8985648792984657405819859826313176981196217307008036698283655081582755421741
        ],
        [
            18328130586283664996398902313462678831804371129516066631975501348972341433048,
            13881050112530180123881961406917304806079564490835131205469176579348634622120
        ]
    ];
    
    uint256[2] c = [
        7238302260638527072224446170363892507722524880496193975743482698772517740936,
        9672733582736525090582542746366377292859987991974323754099850465276411893592
    ];
    
    // Circuit outputs in snarkjs order:
    // [commitment, nullifier, batch_id, valid, batch_id_out, max_price_impact, oracle_price]
    uint256[7] circuitOutputs = [
        13468043774493541282573903797802325966421488021005027815126650173264005873332, // commitment
        14969509321192296083583858150834406960669382495771853255563273696969058906816, // nullifier
        1,      // batch_id
        1,      // valid
        1,      // batch_id_out
        10000,  // max_price_impact
        200000000000  // oracle_price
    ];
    
    function setUp() public {
        vm.createSelectFork("https://eth-sepolia.g.alchemy.com/v2/DFCXUzLyQhp00HIXt2NTo");
    }
    
    function testPermutation0() public { tryOrder(0, 1, 2, 3, 4, 5, 6, "snarkjs native"); }
    function testPermutation1() public { tryOrder(2, 5, 6, 0, 1, 4, 3, "batch_id,max_price,oracle,commit,nullifier,batch_id_out,valid"); }
    function testPermutation2() public { tryOrder(2, 0, 1, 3, 4, 5, 6, "batch_id,commit,nullifier,valid,batch_id_out,max_price,oracle"); }
    function testPermutation3() public { tryOrder(0, 1, 2, 4, 5, 6, 3, "commit,nullifier,batch_id,batch_id_out,max_price,oracle,valid"); }
    
    function tryOrder(
        uint i0, uint i1, uint i2, uint i3, uint i4, uint i5, uint i6,
        string memory desc
    ) internal {
        uint256[7] memory signals;
        signals[0] = circuitOutputs[i0];
        signals[1] = circuitOutputs[i1];
        signals[2] = circuitOutputs[i2];
        signals[3] = circuitOutputs[i3];
        signals[4] = circuitOutputs[i4];
        signals[5] = circuitOutputs[i5];
        signals[6] = circuitOutputs[i6];
        
        (bool success, bytes memory returnData) = VERIFIER.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c, signals
            )
        );
        
        if (returnData.length > 0) {
            bool result = abi.decode(returnData, (bool));
            if (result) {
                console.log("*** FOUND WORKING ORDER! ***");
                console.log(desc);
                console.log("Success!");
            }
        }
    }
}
