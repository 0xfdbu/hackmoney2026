// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import "../src/SwapRouter.sol";
import "../src/CommitStore.sol";
import "../src/DarkPoolHook.sol";

/**
 * @title Deploy
 * @notice Deploy all PrivyFlow contracts
 * @dev Run this script to deploy CommitStore, DarkPoolHook, and SwapRouter
 */
contract Deploy is Script {
    // Sepolia addresses
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);
        
        console.log("Deployer:", deployer);
        console.log("PoolManager:", POOL_MANAGER);
        
        vm.startBroadcast(pk);
        
        // 1. Deploy CommitStore
        CommitStore commitStore = new CommitStore();
        console.log("CommitStore deployed:", address(commitStore));
        
        // 2. Deploy DarkPoolHook
        DarkPoolHook hook = new DarkPoolHook(IPoolManager(POOL_MANAGER), address(commitStore));
        console.log("DarkPoolHook deployed:", address(hook));
        
        // 3. Deploy SwapRouter
        SwapRouter router = new SwapRouter(IPoolManager(POOL_MANAGER));
        console.log("SwapRouter deployed:", address(router));
        
        vm.stopBroadcast();
        
        console.log("\n=== Deployment Complete ===");
        console.log("CommitStore:", address(commitStore));
        console.log("DarkPoolHook:", address(hook));
        console.log("SwapRouter:", address(router));
        console.log("\nNext steps:");
        console.log("1. Update constants.ts with new addresses");
        console.log("2. Run InitPool.s.sol to initialize pool with hook");
        console.log("3. Run AddLiquidity.s.sol to add liquidity");
    }
}
