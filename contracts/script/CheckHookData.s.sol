// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

contract CheckHookData is Script {
    function run() external pure {
        bytes32 commitment = 0x0f62c85ea8b3c623bf454a04604ff47cf5491ef315e2b0d1fa6029a9ac1637d4;
        uint256 salt = 2516323843208679936;
        uint256 minOut = 0;
        
        // This is what the frontend encodes
        bytes memory hookData = abi.encode(commitment, salt, minOut);
        
        console.log("Hook data (Solidity):");
        console.logBytes(hookData);
        console.log("\nLength:", hookData.length);
        
        // Decode to verify
        (bytes32 c, uint256 s, uint256 m) = abi.decode(hookData, (bytes32, uint256, uint256));
        console.log("\nDecoded commitment:", vm.toString(c));
        console.log("Decoded salt:", s);
        console.log("Decoded minOut:", m);
    }
}
