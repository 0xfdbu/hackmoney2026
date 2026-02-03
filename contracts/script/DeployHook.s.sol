// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {PrivyFlowHook} from "../src/PrivyFlowHook.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";

contract DeployHook is Script {
    function run() external {
        address poolManager = 0x99C29E2D4F2f8A9f9e2a1f962dD659c5e8F5e7D3; // Sepolia PoolManager
        address verifier = 0xYourDeployedVerifierAddressHere; // Paste from previous deploy

        vm.startBroadcast();

        PrivyFlowHook hook = new PrivyFlowHook(IPoolManager(poolManager), verifier);
        console.log("PrivyFlowHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}