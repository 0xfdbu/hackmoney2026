// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

/**
 * @title AddLiquidity
 * @notice Add liquidity to the USDC/WETH pool with the DarkPoolHook
 * @dev Run this after InitPool.s.sol to add initial liquidity
 */
contract AddLiquidity is Script {
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        console.log("Adding liquidity to privacy pool...");
        console.log("User:", user);
        
        vm.startBroadcast(pk);
        
        // Amounts to add - adjust these based on your needs
        uint256 usdcAmount = 10e6;     // 10 USDC
        uint256 wethAmount = 0.005e18; // 0.005 WETH (~$10 at $2000/ETH)
        
        console.log("USDC amount:", usdcAmount);
        console.log("WETH amount:", wethAmount);
        
        // Check and wrap ETH if needed
        uint256 wethBal = IERC20(WETH).balanceOf(user);
        if (wethBal < wethAmount) {
            uint256 needed = wethAmount - wethBal;
            console.log("Wrapping ETH:", needed);
            (bool success, ) = WETH.call{value: needed}(abi.encodeWithSignature("deposit()"));
            require(success, "ETH wrap failed");
        }
        
        // Check USDC balance
        uint256 usdcBal = IERC20(USDC).balanceOf(user);
        require(usdcBal >= usdcAmount, "Insufficient USDC");
        
        // Approve tokens
        IERC20(USDC).approve(POOL_MANAGER, usdcAmount);
        IERC20(WETH).approve(POOL_MANAGER, wethAmount);
        
        // Build pool key (USDC is currency0 since address < WETH)
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // Add liquidity around current price (tick 0 for 1:1 pool)
        // Tick 0 = price of 1.0, tick spacing is 60
        // We add liquidity from tick -60 to +60 (around the current price)
        int24 tickLower = -60;
        int24 tickUpper = 60;
        int256 liquidityDelta = 10000000000000; // Adjust based on amounts
        
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidityDelta,
            salt: bytes32(0)
        });
        
        console.log("Adding liquidity...");
        console.log("Tick lower:", vm.toString(tickLower));
        console.log("Tick upper:", vm.toString(tickUpper));
        
        try IPoolManager(POOL_MANAGER).modifyLiquidity(key, params, bytes("")) returns (BalanceDelta delta, BalanceDelta) {
            console.log("Liquidity added!");
            console.log("USDC used:", uint256(int256(-delta.amount0())));
            console.log("WETH used:", uint256(int256(-delta.amount1())));
        } catch Error(string memory r) {
            console.log("Failed:", r);
        } catch (bytes memory r) {
            console.log("Failed with bytes:");
            console.logBytes(r);
        }
        
        vm.stopBroadcast();
    }
    
    receive() external payable {}
}
