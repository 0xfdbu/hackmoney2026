// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";

contract DebugSwap is Script {
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    
    function run() external view {
        uint160 hookAddr = uint160(HOOK);
        
        uint160 beforeSwapFlag = uint160(Hooks.BEFORE_SWAP_FLAG);
        uint160 returnsDeltaFlag = uint160(Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
        
        console.log("BEFORE_SWAP_FLAG (bit 7):", uint256(beforeSwapFlag));
        console.log("BEFORE_SWAP_RETURNS_DELTA_FLAG (bit 3):", uint256(returnsDeltaFlag));
        console.log("Hook has BEFORE_SWAP_FLAG:", (hookAddr & beforeSwapFlag) != 0);
        console.log("Hook has BEFORE_SWAP_RETURNS_DELTA_FLAG:", (hookAddr & returnsDeltaFlag) != 0);
        
        // Check other flags
        console.log("Hook address bits (first 16 bits):", (hookAddr & 0xFFFF));
    }
}
