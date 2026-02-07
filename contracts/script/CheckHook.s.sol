// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract CheckHook is Script {
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    
    function run() external view {
        // Check hook permissions
        console.log("Hook permissions:");
        console.log("Address:", HOOK);
        uint160 addr = uint160(HOOK);
        console.log("BEFORE_SWAP_FLAG (bit 7):", addr & uint160(1 << 7));
        console.log("AFTER_SWAP_FLAG (bit 6):", addr & uint160(1 << 6));
        console.log("BEFORE_SWAP_RETURNS_DELTA_FLAG (bit 3):", addr & uint160(1 << 3));
        console.log("AFTER_SWAP_RETURNS_DELTA_FLAG (bit 2):", addr & uint160(1 << 2));
    }
}
