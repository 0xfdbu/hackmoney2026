// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

// Helper contract to check pool state
contract PoolChecker {
    using PoolIdLibrary for PoolKey;
    
    bytes32 public constant POOLS_SLOT = bytes32(uint256(6));
    
    function getPoolStateSlot(PoolId poolId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
    }
    
    function isInitialized(IPoolManager manager, PoolKey memory key) public view returns (bool) {
        bytes32 slot = getPoolStateSlot(key.toId());
        
        try manager.extsload(slot) returns (bytes32 data) {
            uint160 sqrtPriceX96 = uint160(uint256(data));
            return sqrtPriceX96 != 0;
        } catch {
            return false;
        }
    }
}

contract InitETHUSDCPool is Script {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK_ADDRESS = 0xCAC28E99c67B2f54A92f602046136899dA296080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    
    // Change these to initialize different pools
    uint24 constant FEE = 3000;  // 0.3% = 3000, 1% = 10000
    int24 constant TICK_SPACING = 60; // 60 for 0.3%, 200 for 1%
    
    function run() external {
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IHooks hooks = IHooks(HOOK_ADDRESS);
        PoolChecker checker = new PoolChecker();
        
        // Native ETH is address(0)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),       // USDC
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: hooks
        });
        
        console.log("ETH/USDC Pool:");
        console.log("  currency0: address(0) (ETH)");
        console.log("  currency1:", USDC);
        console.log("  fee:", FEE);
        console.log("  tickSpacing:", TICK_SPACING);
        console.log("  hooks:", HOOK_ADDRESS);
        
        // Check if already initialized
        if (checker.isInitialized(poolManager, key)) {
            console.log("  Status: ALREADY INITIALIZED");
            return;
        }
        
        console.log("  Status: NOT INITIALIZED - will initialize now");
        
        // Initialize at price = 1.0
        uint160 sqrtPriceX96 = 79228162514264337593543950336;
        
        vm.startBroadcast();
        try poolManager.initialize(key, sqrtPriceX96) returns (int24 tick) {
            console.log("  SUCCESS! Pool initialized at tick:", tick);
        } catch (bytes memory reason) {
            console.log("  FAILED to initialize");
            console.logBytes(reason);
        }
        vm.stopBroadcast();
    }
}
