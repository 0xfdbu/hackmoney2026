// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {CurrencyLibrary, Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

contract AddLiquidity is Script {
    IPoolManager poolManager;
    PoolKey key;
    address usdc;
    address eth;
    uint256 ethAmount;
    uint256 usdcAmount;
    
    function run() external {
        poolManager = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);
        address hook = 0x830C433e3493b0B84A430103D95ea94a59A7eea0;
        
        eth = 0x0000000000000000000000000000000000000000;
        usdc = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
        
        key = PoolKey({
            currency0: Currency.wrap(eth),
            currency1: Currency.wrap(usdc),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(hook)
        });
        
        // EDIT THESE AMOUNTS
        ethAmount = 0.001 ether;      // 0.001 ETH
        usdcAmount = 1 * 10**6;       // 1 USDC (6 decimals)
        
        vm.startBroadcast();
        
        // 1. Approve this contract to pull USDC from wallet
        IERC20(usdc).approve(address(this), usdcAmount);
        
        // 2. Pull USDC from wallet to this contract
        IERC20(usdc).transferFrom(msg.sender, address(this), usdcAmount);
        
        // 3. Approve PoolManager to spend USDC from this contract
        IERC20(usdc).approve(address(poolManager), usdcAmount);
        
        // Fixed console.log - separate arguments, no string concatenation
        console.log("Adding liquidity:");
        console.log("  ETH:", ethAmount);
        console.log("  USDC:", usdcAmount);
        
        // 4. Call lock (triggers lockAcquired callback)
        bytes memory data = abi.encode(ethAmount, usdcAmount);
        poolManager.lock(data);
        
        console.log("Liquidity added successfully!");
        
        vm.stopBroadcast();
    }
    
    // Lock callback - called by PoolManager
    function lockAcquired(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Not pool manager");
        
        (uint256 ethAmt, uint256 usdcAmt) = abi.decode(data, (uint256, uint256));
        
        // Add liquidity parameters
        int24 tickLower = -60;  // Narrow range around 1:1 price
        int24 tickUpper = 60;
        
        // Calculate liquidity (simplified - for 1:1 price range)
        int128 liquidityDelta = int128(int256(ethAmt));
        
        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidityDelta: liquidityDelta,
            salt: bytes32(0)
        });
        
        // Add liquidity
        (BalanceDelta delta, ) = poolManager.modifyLiquidity(key, params, hex"");
        
        // Fixed console.log calls
        console.log("Delta amount0:", uint256(int256(delta.amount0())));
        console.log("Delta amount1:", uint256(int256(delta.amount1())));
        
        // Settle ETH (send ETH to PoolManager)
        if (delta.amount0() < 0) {
            poolManager.settle{value: uint128(-delta.amount0())}(key.currency0);
        }
        
        // Settle USDC (transfer USDC to PoolManager)
        if (delta.amount1() < 0) {
            IERC20(Currency.unwrap(key.currency1)).transfer(address(poolManager), uint128(-delta.amount1()));
            poolManager.settle(key.currency1);
        }
        
        // Take any refunds
        if (delta.amount0() > 0) {
            poolManager.take(key.currency0, address(this), uint128(delta.amount0()));
        }
        if (delta.amount1() > 0) {
            poolManager.take(key.currency1, address(this), uint128(delta.amount1()));
        }
        
        return hex"";
    }
    
    receive() external payable {}
}