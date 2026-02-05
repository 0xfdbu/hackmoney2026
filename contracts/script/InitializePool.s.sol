// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract InitializePool is Script {
    using CurrencyLibrary for Currency;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK_ADDRESS = 0xCAC28E99c67B2f54A92f602046136899dA296080;
    
    // Sepolia token addresses
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        vm.startBroadcast();
        
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IHooks hooks = IHooks(HOOK_ADDRESS);
        
        // Initialize USDC/WETH pool (1% fee) - matches the already initialized pool
        _initializePool(
            poolManager,
            hooks,
            USDC,           // currency0 (lower address)
            WETH,           // currency1 (higher address)
            10000,          // 1% fee
            200,            // tick spacing for 1%
            79228162514264337593543950336 // sqrtPriceX96 = 1.0
        );
        
        // Initialize ETH/USDC pool (0.3% fee) - native ETH
        _initializePool(
            poolManager,
            hooks,
            address(0),     // currency0 = native ETH (address 0)
            USDC,           // currency1
            3000,           // 0.3% fee
            60,             // tick spacing for 0.3%
            79228162514264337593543950336 // sqrtPriceX96 = 1.0
        );
        
        // Initialize ETH/USDC pool (1% fee)
        _initializePool(
            poolManager,
            hooks,
            address(0),     // currency0 = native ETH
            USDC,           // currency1
            10000,          // 1% fee
            200,            // tick spacing for 1%
            79228162514264337593543950336
        );
        
        vm.stopBroadcast();
    }
    
    function _initializePool(
        IPoolManager poolManager,
        IHooks hooks,
        address currency0,
        address currency1,
        uint24 fee,
        int24 tickSpacing,
        uint160 sqrtPriceX96
    ) internal {
        // Sort currencies if needed (currency0 must be < currency1, except for native ETH)
        address c0 = currency0;
        address c1 = currency1;
        
        // If currency0 is address(0) (ETH), it should stay as currency0
        // Otherwise sort normally
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
        
        console.log("Initializing pool:");
        console.log("  currency0:", c0);
        console.log("  currency1:", c1);
        console.log("  fee:", fee);
        console.log("  tickSpacing:", tickSpacing);
        
        try poolManager.initialize(key, sqrtPriceX96) returns (int24 tick) {
            console.log("  SUCCESS! Tick:", tick);
        } catch (bytes memory reason) {
            // Check if it's AlreadyInitialized error
            if (keccak256(reason) == keccak256(abi.encodeWithSignature("AlreadyInitialized()"))) {
                console.log("  Pool already initialized");
            } else if (keccak256(reason) == keccak256(abi.encodeWithSignature("PoolAlreadyInitialized()"))) {
                console.log("  Pool already initialized");
            } else {
                console.log("  FAILED");
                console.logBytes(reason);
            }
        }
    }
}
