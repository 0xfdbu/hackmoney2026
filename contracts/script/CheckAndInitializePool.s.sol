// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

// Manual interface for getSlot0
interface IPoolManagerExtended {
    function getSlot0(bytes32 poolId) external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint24 protocolFee,
        uint24 lpFee
    );
}

contract CheckAndInitializePool is Script {
    function run() external {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address hook = 0x830C433e3493b0B84A430103D95ea94a59A7eea0;
        
        address eth = 0x0000000000000000000000000000000000000000;
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(eth),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        bytes32 poolId = keccak256(abi.encode(key));
        
        console.log("Checking pool with ID:");
        console.logBytes32(poolId);
        
        // Use extended interface
        IPoolManagerExtended manager = IPoolManagerExtended(poolManager);
        
        try manager.getSlot0(poolId) returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint24 protocolFee,
            uint24 lpFee
        ) {
            if (sqrtPriceX96 == 0) {
                console.log("Pool EXISTS but NOT initialized");
                _initialize(poolManager, key);
            } else {
                console.log("Pool ALREADY initialized!");
                console.log("sqrtPriceX96:", sqrtPriceX96);
                console.log("tick:", tick);
            }
        } catch {
            console.log("Pool does NOT exist, initializing...");
            _initialize(poolManager, key);
        }
    }
    
    function _initialize(address poolManager, PoolKey memory key) internal {
        vm.startBroadcast();
        IPoolManager(poolManager).initialize(key, 79228162514264337593543950336);
        vm.stopBroadcast();
        console.log("Pool initialized!");
    }
    
    function checkOnly() external view {
        address poolManager = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
        address hook = 0x830C433e3493b0B84A430103D95ea94a59A7eea0;
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(0x0000000000000000000000000000000000000000),
            currency1: Currency.wrap(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        bytes32 poolId = keccak256(abi.encode(key));
        
        (uint160 sqrtPriceX96,,,) = IPoolManagerExtended(poolManager).getSlot0(poolId);
        
        if (sqrtPriceX96 == 0) {
            console.log("NOT initialized");
        } else {
            console.log("IS initialized, price:", sqrtPriceX96);
        }
    }
}