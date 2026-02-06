// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {PositionManager} from "v4-periphery/PositionManager.sol";
import {Actions} from "v4-periphery/libraries/Actions.sol";
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {LiquidityAmounts} from "v4-periphery/libraries/LiquidityAmounts.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

contract AddLiquidityToNewPool is Script {
    function run() external {
        address payable positionManager = payable(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        address hook = 0xD2528A51f7589c11490f3DeA7Fe1a21F9739e080;
        
        // Token addresses
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        address weth = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
        
        // Pool key
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        // Approve Permit2 to spend USDC
        vm.startBroadcast();
        
        uint256 usdcAmount = 10000; // 0.01 USDC
        
        // Approve Permit2
        IERC20(usdc).approve(permit2, type(uint256).max);
        
        // Approve PositionManager via Permit2
        (bool success, ) = permit2.call(
            abi.encodeWithSelector(
                0x87517c45, // approve(address,address,uint160,uint48)
                usdc,
                positionManager,
                uint160(type(uint128).max),
                uint48(block.timestamp + 1 hours)
            )
        );
        require(success, "Permit2 approval failed");
        
        console.log("Approved Permit2 and PositionManager");
        
        // Calculate liquidity amounts
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint256 ethAmount = 10000000000000; // 0.00001 ETH
        
        // Encode MINT_POSITION action
        bytes memory mintParams = abi.encode(
            poolKey,
            tickLower,
            tickUpper,
            1000, // liquidity - small amount
            ethAmount * 100, // max ETH (be generous)
            usdcAmount * 100, // max USDC (be generous)
            0x89feEbA43b294425C0d7B482770eefbcc1359f8d, // recipient (deployer)
            "" // hookData
        );
        
        // Build actions
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );
        
        bytes[] memory params = new bytes[](2);
        params[0] = mintParams;
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        
        // Add liquidity
        PositionManager(positionManager).modifyLiquidities{value: ethAmount}(
            abi.encode(actions, params),
            block.timestamp + 1 hours
        );
        
        console.log("Liquidity added successfully!");
        
        vm.stopBroadcast();
    }
}
