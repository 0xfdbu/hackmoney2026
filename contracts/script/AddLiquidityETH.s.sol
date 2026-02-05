// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

contract AddLiquidityETHScript is Script {
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant HOOK = 0xca3656933c53642BcEEBfD40F0b5D5D3ABCFc3E5;
    
    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;
    
    uint256 constant MINT_POSITION = 0x02;
    uint256 constant SETTLE_PAIR = 0x0d;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("Adding ETH/USDC liquidity as:", user);
        
        // Amounts for ETH/USDC pool (minimal amounts due to limited ETH)
        uint128 amount0 = 10000; // 0.01 USDC (6 decimals)
        uint128 amount1 = 10000000000000000; // 0.01 ETH (18 decimals)
        
        vm.startBroadcast(pk);
        
        // Approve USDC for Permit2
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        
        // Approve Permit2 for PositionManager
        IAllowanceTransfer(PERMIT2).approve(
            USDC,
            POSITION_MANAGER,
            type(uint160).max,
            uint48(block.timestamp + 1 days)
        );
        
        // Build pool key (ETH < USDC by address)
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint128 liquidity = 10000;
        
        // Build actions
        bytes memory actions = abi.encodePacked(
            uint8(MINT_POSITION),
            uint8(SETTLE_PAIR)
        );
        
        // Build params
        bytes[] memory params = new bytes[](2);
        
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
        
        params[1] = abi.encode(
            Currency.unwrap(poolKey.currency0),
            Currency.unwrap(poolKey.currency1)
        );
        
        bytes memory unlockData = abi.encode(actions, params);
        
        console.log("Calling modifyLiquidities with ETH...");
        
        // Call with ETH value (0.01 ETH)
        IPositionManager(POSITION_MANAGER).modifyLiquidities{value: 10000000000000000}(
            unlockData,
            block.timestamp + 600
        );
        
        vm.stopBroadcast();
        
        console.log("ETH/USDC Liquidity added!");
    }
}