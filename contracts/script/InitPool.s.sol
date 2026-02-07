// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract LiquidityChecker {
    using CurrencyLibrary for Currency;
    
    address public immutable poolManager;
    
    constructor(address _poolManager) {
        poolManager = _poolManager;
    }
    
    function checkPool(PoolKey memory key) external view returns (bool exists, uint128 liquidity) {
        bytes32 poolId = keccak256(abi.encode(key));
        
        (bool success, bytes memory result) = poolManager.staticcall(
            abi.encodeWithSelector(
                bytes4(keccak256("getLiquidity(bytes32)")), 
                poolId
            )
        );
        
        if (success && result.length == 32) {
            exists = true;
            liquidity = abi.decode(result, (uint128));
        } else {
            exists = false;
            liquidity = 0;
        }
    }
}

contract InitPoolScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    uint24 constant FEE = 500;
    int24 constant TICK_SPACING = 10;
    
    // Price: 1 USDC = 0.0005 WETH (~$2000/ETH)
    uint160 constant STARTING_PRICE = 5602277097478614198912276234240;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("Initializing pool...");
        console.log("User:", user);
        
        vm.startBroadcast(pk);
        
        LiquidityChecker checker = new LiquidityChecker(POOL_MANAGER);
        
        // Try 1: Initialize WITHOUT hook first (to test if pool works)
        console.log("\n=== Attempt 1: Initialize WITHOUT hook ===");
        
        PoolKey memory keyNoHook = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(address(0))
        });
        
        (bool exists, ) = checker.checkPool(keyNoHook);
        
        if (!exists) {
            try IPoolManager(POOL_MANAGER).initialize(keyNoHook, STARTING_PRICE) returns (int24 tick) {
                console.log("SUCCESS: Pool initialized without hook!");
                console.log("Tick:", vm.toString(tick));
            } catch (bytes memory reason) {
                console.log("FAILED without hook:");
                console.logBytes(reason);
                console.log("\nPossible issues:");
                console.log("1. Wrong PoolManager address");
                console.log("2. Invalid tick spacing for fee tier");
                console.log("3. Pool already exists with different params");
            }
        } else {
            console.log("Pool already exists without hook");
        }
        
        // Try 2: Initialize WITH hook (if no-hook version worked)
        console.log("\n=== Attempt 2: Initialize WITH hook ===");
        
        PoolKey memory keyWithHook = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        (bool existsWithHook, ) = checker.checkPool(keyWithHook);
        
        if (!existsWithHook) {
            try IPoolManager(POOL_MANAGER).initialize(keyWithHook, STARTING_PRICE) returns (int24 tick) {
                console.log("SUCCESS: Pool initialized with hook!");
                console.log("Tick:", vm.toString(tick));
            } catch (bytes memory reason) {
                console.log("FAILED with hook:");
                console.logBytes(reason);
                console.log("\nThe hook address is invalid!");
                console.log("In Uniswap V4, hook addresses need specific vanity prefixes.");
                console.log("Deploy your hook with proper address flags or use address(0).");
                console.log("Error 0x7983c051 likely means HooksInvalidHookAddress");
            }
        } else {
            console.log("Pool already exists with hook");
        }
        
        vm.stopBroadcast();
    }
}