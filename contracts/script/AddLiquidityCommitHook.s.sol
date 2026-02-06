// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {PositionManager} from "v4-periphery/PositionManager.sol";
import {Actions} from "v4-periphery/libraries/Actions.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";

contract AddLiquidityCommitHook is Script {
    function run() external {
        address positionManager = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
        address permit2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
        address hook = 0x30646e72c91705fff997af0FDe5b2f1fbFfB0080;
        address usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        vm.startBroadcast();
        
        // Approve Permit2 for USDC
        IERC20(usdc).approve(permit2, type(uint256).max);
        
        // Approve PositionManager via Permit2
        (bool success, ) = permit2.call(
            abi.encodeWithSelector(
                0x87517c45,
                usdc,
                positionManager,
                uint160(type(uint128).max),
                uint48(block.timestamp + 1 hours)
            )
        );
        require(success, "Permit2 approval failed");
        
        // Add liquidity
        uint256 ethAmount = 10000000000000; // 0.00001 ETH
        uint256 usdcAmount = 10000; // 0.01 USDC
        
        bytes memory mintParams = abi.encode(
            poolKey,
            -887220,
            887220,
            1000,
            ethAmount * 100,
            usdcAmount * 100,
            0x89feEbA43b294425C0d7B482770eefbcc1359f8d,
            ""
        );
        
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR)
        );
        
        bytes[] memory params = new bytes[](2);
        params[0] = mintParams;
        params[1] = abi.encode(poolKey.currency0, poolKey.currency1);
        
        PositionManager(payable(positionManager)).modifyLiquidities{value: ethAmount}(
            abi.encode(actions, params),
            block.timestamp + 1 hours
        );
        
        console.log("Liquidity added!");
        vm.stopBroadcast();
    }
}
