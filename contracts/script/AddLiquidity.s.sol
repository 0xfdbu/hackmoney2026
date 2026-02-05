// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {ISignatureTransfer} from "permit2/src/interfaces/ISignatureTransfer.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract AddLiquidityScript is Script {
    // Sepolia addresses
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0xCAC28E99c67B2f54A92f602046136899dA296080;
    
    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;
    
    // Action constants
    uint256 constant MINT_POSITION = 0x02;
    uint256 constant SETTLE_PAIR = 0x0d;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("Adding liquidity as:", user);
        
        // Amounts - use smaller amounts (wallet has ~4 USDC)
        uint128 amount0 = 2000000; // 2 USDC max (6 decimals)
        uint128 amount1 = 2000000000000000000; // 2 WETH max (18 decimals)
        uint128 liquidity = 1000000; // 1e6 liquidity units
        
        vm.startBroadcast(pk);
        
        // Step 1: Approve tokens for Permit2
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        IERC20(WETH).approve(PERMIT2, type(uint256).max);
        
        // Step 2: Approve Permit2 for PositionManager (allowance transfer)
        IAllowanceTransfer(PERMIT2).approve(
            USDC,
            POSITION_MANAGER,
            type(uint160).max,
            uint48(block.timestamp + 1 days)
        );
        IAllowanceTransfer(PERMIT2).approve(
            WETH,
            POSITION_MANAGER,
            type(uint160).max,
            uint48(block.timestamp + 1 days)
        );
        
        // Step 3: Build the mint parameters
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        // Use min/max ticks aligned to tick spacing
        // TickMath.MIN_TICK = -887272, MAX_TICK = 887272
        // Must be multiple of tickSpacing (60)
        // Note: Solidity integer division truncates toward zero
        // -887272 / 60 = -14787, -14787 * 60 = -887220
        // 887272 / 60 = 14787, 14787 * 60 = 887220
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        
        // Step 4: Build actions
        bytes memory actions = abi.encodePacked(
            uint8(MINT_POSITION),
            uint8(SETTLE_PAIR)
        );
        
        // Step 5: Build params
        bytes[] memory params = new bytes[](2);
        
        // MINT_POSITION params
        params[0] = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            liquidity,
            amount0,
            amount1,
            user,
            bytes("")
        );
        
        // SETTLE_PAIR params
        params[1] = abi.encode(
            Currency.unwrap(poolKey.currency0),
            Currency.unwrap(poolKey.currency1)
        );
        
        // Step 6: Encode unlockData
        bytes memory unlockData = abi.encode(actions, params);
        
        console.log("Calling modifyLiquidities...");
        console.log("Actions length:", actions.length);
        console.log("Params length:", params.length);
        
        // Step 7: Call modifyLiquidities
        IPositionManager(POSITION_MANAGER).modifyLiquidities(
            unlockData,
            block.timestamp + 600
        );
        
        vm.stopBroadcast();
        
        console.log("Liquidity added successfully!");
    }
}