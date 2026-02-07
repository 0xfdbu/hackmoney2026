// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract SimpleLiquidityAdder {
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;
    
    IPoolManager public immutable manager;
    
    constructor(IPoolManager _manager) {
        manager = _manager;
    }
    
    function addLiquidity(
        PoolKey calldata key, 
        int24 tickLower, 
        int24 tickUpper, 
        int256 liquidityDelta
    ) external returns (BalanceDelta) {
        bytes memory data = abi.encode(key, tickLower, tickUpper, liquidityDelta, msg.sender);
        bytes memory result = manager.unlock(data);
        return abi.decode(result, (BalanceDelta));
    }
    
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "Not manager");
        (PoolKey memory key, int24 tickLower, int24 tickUpper, int256 liquidityDelta, address sender) = 
            abi.decode(data, (PoolKey, int24, int24, int256, address));
        
        // Modify liquidity
        (BalanceDelta delta, ) = manager.modifyLiquidity(
            key, 
            ModifyLiquidityParams({
                tickLower: tickLower,
                tickUpper: tickUpper,
                liquidityDelta: liquidityDelta,
                salt: bytes32(0)
            }), 
            bytes("")
        );

        console.log("Delta0:", delta.amount0());
        console.log("Delta1:", delta.amount1());

        // Extract amounts from delta
        int128 amount0 = delta.amount0();
        int128 amount1 = delta.amount1();

        // Settle currency0
        if (amount0 > 0) {
            // We owe currency0
            _settle(key.currency0, sender, uint256(int256(amount0)));
        } else if (amount0 < 0) {
            // Pool owes us currency0
            manager.take(key.currency0, sender, uint256(int256(-amount0)));
        }
        
        // Settle currency1
        if (amount1 > 0) {
            // We owe currency1
            _settle(key.currency1, sender, uint256(int256(amount1)));
        } else if (amount1 < 0) {
            // Pool owes us currency1
            manager.take(key.currency1, sender, uint256(int256(-amount1)));
        }
        
        return abi.encode(delta);
    }
    
    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (amount == 0) return;
        
        if (currency.isAddressZero()) {
            // Native ETH
            manager.settle{value: amount}();
        } else {
            // ERC20 token - transfer to manager then settle
            IERC20(Currency.unwrap(currency)).transferFrom(payer, address(manager), amount);
            
            // Call settle(Currency) using low-level call
            (bool success, bytes memory returnData) = address(manager).call(
                abi.encodeWithSelector(bytes4(keccak256("settle(Currency)")), currency)
            );
            
            require(success, "Settle failed");
        }
    }
}

contract AddLiquidityScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        SimpleLiquidityAdder adder = new SimpleLiquidityAdder(IPoolManager(POOL_MANAGER));
        
        // Ensure broad approvals
        IERC20(USDC).approve(address(adder), type(uint256).max);
        IERC20(WETH).approve(address(adder), type(uint256).max);
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 500,
            tickSpacing: 10,
            hooks: IHooks(HOOK)
        });
        
        adder.addLiquidity(key, -100, 100, 1000000000);
        
        console.log("Liquidity successfully added!");
        vm.stopBroadcast();
    }
}