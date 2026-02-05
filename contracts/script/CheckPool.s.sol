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

// Helper contract to check pool state using extsload
contract PoolChecker {
    using PoolIdLibrary for PoolKey;
    
    bytes32 public constant POOLS_SLOT = bytes32(uint256(6));
    
    function getPoolStateSlot(PoolId poolId) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(PoolId.unwrap(poolId), POOLS_SLOT));
    }
    
    function checkPool(IPoolManager manager, PoolKey memory key) public view returns (bool initialized, uint160 sqrtPriceX96, int24 tick) {
        bytes32 slot = getPoolStateSlot(key.toId());
        
        // Try to read the slot - if it reverts, pool doesn't exist
        try manager.extsload(slot) returns (bytes32 data) {
            // First 160 bits are sqrtPriceX96
            sqrtPriceX96 = uint160(uint256(data));
            // Next 24 bits are tick (bits 160-183)
            tick = int24(int256(uint256(data) >> 160));
            initialized = sqrtPriceX96 != 0;
        } catch {
            initialized = false;
        }
    }
}

contract CheckPool is Script {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK_ADDRESS = 0xCAC28E99c67B2f54A92f602046136899dA296080;
    
    // Sepolia token addresses
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IHooks hooks = IHooks(HOOK_ADDRESS);
        PoolChecker checker = new PoolChecker();
        
        console.log("Checking pools...");
        console.log("PoolManager:", POOL_MANAGER);
        console.log("Hook:", HOOK_ADDRESS);
        console.log("");
        
        // Check USDC/WETH 1% pool
        _checkPool(poolManager, hooks, checker, USDC, WETH, 10000, 200);
        
        // Check ETH/USDC 0.3% pool  
        _checkPool(poolManager, hooks, checker, address(0), USDC, 3000, 60);
        
        // Check ETH/USDC 1% pool
        _checkPool(poolManager, hooks, checker, address(0), USDC, 10000, 200);
    }
    
    function _checkPool(
        IPoolManager poolManager,
        IHooks hooks,
        PoolChecker checker,
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing
    ) internal view {
        // Sort tokens
        address c0 = currency0;
        address c1 = currency1;
        
        if (currency0 != address(0) && uint160(currency0) > uint160(currency1)) {
            (c0, c1) = (c1, c0);
        }
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(c0),
            currency1: Currency.wrap(c1),
            fee: fee,
            tickSpacing: tickSpacing,
            hooks: hooks
        });
        
        (bool initialized, uint160 sqrtPriceX96, int24 tick) = checker.checkPool(poolManager, key);
        
        console.log("Pool:");
        console.log("  c0:", c0);
        console.log("  c1:", c1);
        console.log("  fee:", fee);
        if (initialized) {
            console.log("  Status: INITIALIZED");
            console.log("  sqrtPriceX96:", sqrtPriceX96);
            console.log("  tick:", tick);
        } else {
            console.log("  Status: NOT INITIALIZED");
        }
        console.log("");
    }
}
