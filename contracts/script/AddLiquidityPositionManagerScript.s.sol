// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

interface IPositionManager {
    function modifyLiquidities(bytes calldata payload, uint256 deadline) external payable;
    function multicall(bytes[] calldata data) external payable returns (bytes[] memory results);
}

interface IPermit2 {
    function approve(address token, address spender, uint160 amount, uint48 expiration) external;
}

library Actions {
    uint256 constant MINT_POSITION = 0;
    uint256 constant SETTLE_PAIR = 4;
    uint256 constant SWEEP = 6;
}

contract AddLiquidityPositionManagerScript is Script {
    using CurrencyLibrary for Currency;
    using StateLibrary for IPoolManager;
    
    address constant POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    
    // Match the newly created pool
    uint24 constant FEE = 100;
    int24 constant TICK_SPACING = 1;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = vm.addr(pk);
        
        vm.startBroadcast(pk);
        
        IPoolManager poolManager = IPoolManager(POOL_MANAGER);
        IPositionManager posm = IPositionManager(POSITION_MANAGER);
        IPermit2 permit2 = IPermit2(PERMIT2);
        
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        // Verify pool exists
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(poolKey.toId());
        require(sqrtPriceX96 != 0, "Pool not initialized");
        console.log("Pool found! sqrtPriceX96:", sqrtPriceX96);
        
        int24 currentTick = TickMath.getTickAtSqrtPrice(sqrtPriceX96);
        int24 tickLower = ((currentTick - 100 * TICK_SPACING) / TICK_SPACING) * TICK_SPACING;
        int24 tickUpper = ((currentTick + 100 * TICK_SPACING) / TICK_SPACING) * TICK_SPACING;
        
        console.log("Current tick:"); console.logInt(currentTick);
        console.log("Adding liquidity between"); console.logInt(tickLower); console.logInt(tickUpper);

        uint128 liquidity = 1e15;
        uint256 amount0Max = 100 * 1e6;   // 100 USDC
        uint256 amount1Max = 0.05 ether;  // 0.05 WETH

        // Encode actions
        bytes memory actions = abi.encodePacked(
            uint8(Actions.MINT_POSITION),
            uint8(Actions.SETTLE_PAIR),
            uint8(Actions.SWEEP),
            uint8(Actions.SWEEP)
        );

        bytes[] memory params = new bytes[](4);
        params[0] = abi.encode(poolKey, tickLower, tickUpper, liquidity, amount0Max, amount1Max, user, bytes(""));
        params[1] = abi.encode(Currency.wrap(USDC), Currency.wrap(WETH));
        params[2] = abi.encode(Currency.wrap(USDC), user);
        params[3] = abi.encode(Currency.wrap(WETH), user);

        // Approve via Permit2
        IERC20(USDC).approve(PERMIT2, amount0Max);
        IERC20(WETH).approve(PERMIT2, amount1Max);
        permit2.approve(USDC, POSITION_MANAGER, uint160(amount0Max), uint48(block.timestamp + 3600));
        permit2.approve(WETH, POSITION_MANAGER, uint160(amount1Max), uint48(block.timestamp + 3600));
        console.log("Approvals done");

        bytes[] memory multicallParams = new bytes[](1);
        multicallParams[0] = abi.encodeWithSelector(
            posm.modifyLiquidities.selector,
            abi.encode(actions, params),
            block.timestamp + 3600
        );

        console.log("Adding liquidity via PositionManager...");
        posm.multicall(multicallParams);
        console.log("Success!");
        
        vm.stopBroadcast();
    }
}