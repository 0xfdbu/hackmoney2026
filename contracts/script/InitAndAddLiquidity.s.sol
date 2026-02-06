// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract InitAndAddLiquidityScript is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    // NEW HOOK
    address constant HOOK = 0xCab0Dc0c50C3015EE87D12C8d6B4D89e0e5D40C0;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("Setting up pool from:", user);
        
        vm.startBroadcast(pk);
        
        // 1. Initialize ETH/USDC pool
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(USDC),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        IPoolManager(POOL_MANAGER).initialize(poolKey, 79228162514264337593543950336);
        console.log("Pool initialized!");
        
        // 2. Add liquidity (minimal amounts)
        uint128 amount0 = 10000; // 0.01 USDC
        uint128 amount1 = 10000000000000000; // 0.01 ETH
        
        // Approve tokens
        IERC20(USDC).approve(PERMIT2, type(uint256).max);
        IAllowanceTransfer(PERMIT2).approve(USDC, POSITION_MANAGER, type(uint160).max, uint48(block.timestamp + 1 days));
        
        // Build actions
        bytes memory actions = abi.encodePacked(uint8(0x02), uint8(0x0d));
        
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(poolKey, -887220, 887220, 10000, amount0, amount1, user, bytes(""));
        params[1] = abi.encode(address(0), USDC);
        
        bytes memory unlockData = abi.encode(actions, params);
        
        IPositionManager(POSITION_MANAGER).modifyLiquidities{value: amount1}(unlockData, block.timestamp + 600);
        
        console.log("Liquidity added!");
        
        vm.stopBroadcast();
    }
}