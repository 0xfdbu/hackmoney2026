// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol"; // Add this
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

interface IPoolModifyLiquidityTest {
    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external returns (BalanceDelta delta, BalanceDelta fees); // Use BalanceDelta directly
}

contract CreatePoolAndAddLiquidityScript is Script {
    using CurrencyLibrary for Currency;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant LP_ROUTER = 0x0C478023803a644c94c4CE1C1e7b9A087e411B0A;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    
    uint24 constant FEE = 100;
    int24 constant TICK_SPACING = 1;
    uint160 constant STARTING_PRICE = 2505413461900723139654726429188;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        vm.startBroadcast(pk);
        
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IPoolModifyLiquidityTest lpRouter = IPoolModifyLiquidityTest(LP_ROUTER);
        
        Currency currency0 = Currency.wrap(USDC);
        Currency currency1 = Currency.wrap(WETH);
        
        PoolKey memory poolKey = PoolKey({
            currency0: currency0,
            currency1: currency1,
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        console.log("Initializing pool...");
        try poolManager.initialize(poolKey, STARTING_PRICE) {
            console.log("Pool initialized!");
        } catch (bytes memory err) {
            if (err.length >= 4) {
                bytes4 selector;
                assembly { selector := mload(add(err, 32)) }
                if (selector == 0x7983c051) {
                    console.log("Pool already exists, proceeding...");
                } else {
                    console.log("Init error:", vm.toString(selector));
                }
            }
        }
        
        IERC20(USDC).approve(address(lpRouter), 1000 * 1e6);
        IERC20(WETH).approve(address(lpRouter), 1 ether);
        console.log("Tokens approved");
        
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -100,
            tickUpper: 100,
            liquidityDelta: 1e15,
            salt: 0
        });
        
        console.log("Adding liquidity...");
        
        (BalanceDelta delta, BalanceDelta fees) = lpRouter.modifyLiquidity(
            poolKey,
            params,
            ""
        );
        
        console.log("Success!");
        
        if (delta.amount0() < 0) {
            console.log("USDC spent:", uint256(-int256(delta.amount0())));
        }
        if (delta.amount1() < 0) {
            console.log("WETH spent:", uint256(-int256(delta.amount1())));
        }
        
        vm.stopBroadcast();
    }
}