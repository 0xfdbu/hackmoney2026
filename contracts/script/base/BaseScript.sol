// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {console} from "forge-std/console.sol";

// Fix: Use correct import paths
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IPositionManager} from "v4-periphery/interfaces/IPositionManager.sol";
import {IPermit2} from "permit2/src/interfaces/IPermit2.sol";

/// @notice Shared configuration for Sepolia deployment
contract BaseScript is Script {
    using CurrencyLibrary for Currency;

    address immutable deployerAddress;

    /////////////////////////////////////
    // --- Sepolia Addresses ---
    /////////////////////////////////////
    
    // Tokens
    IERC20 internal constant token0 = IERC20(0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238); // USDC
    IERC20 internal constant token1 = IERC20(0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14); // WETH
    
    // Uniswap v4 Contracts
    IPoolManager internal constant poolManager = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);
    IPositionManager internal constant positionManager = IPositionManager(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4);
    IPermit2 internal constant permit2 = IPermit2(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    
    // Hook (your deployed hook address or address(0) for no hook)
    IHooks constant hookContract = IHooks(0x77853497C9dEC9460fb305cbcD80C7DAF4EcDC54);
    
    // StateView for reading pool state
    address constant stateView = 0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C;
    
    /////////////////////////////////////

    Currency immutable currency0;
    Currency immutable currency1;

    constructor() {
        deployerAddress = msg.sender;

        // Ensure correct ordering: currency0 < currency1
        (currency0, currency1) = getCurrencies();

        // Labels for trace debugging
        vm.label(address(poolManager), "V4PoolManager");
        vm.label(address(positionManager), "V4PositionManager");
        vm.label(address(permit2), "Permit2");
        vm.label(address(token0), "USDC");
        vm.label(address(token1), "WETH");
        vm.label(address(hookContract), "HookContract");
        vm.label(stateView, "StateView");
    }

    function getCurrencies() internal pure returns (Currency, Currency) {
        require(address(token0) != address(token1), "Same token");

        // Return sorted (address lower = currency0)
        if (address(token0) < address(token1)) {
            return (Currency.wrap(address(token0)), Currency.wrap(address(token1)));
        } else {
            return (Currency.wrap(address(token1)), Currency.wrap(address(token0)));
        }
    }

    function tokenApprovals() public {
        // Approve Permit2 to spend tokens
        if (!currency0.isAddressZero()) {
            token0.approve(address(permit2), type(uint256).max);
            permit2.approve(address(token0), address(positionManager), type(uint160).max, type(uint48).max);
            console.log("Approved token0 via Permit2");
        }

        if (!currency1.isAddressZero()) {
            token1.approve(address(permit2), type(uint256).max);
            permit2.approve(address(token1), address(positionManager), type(uint160).max, type(uint48).max);
            console.log("Approved token1 via Permit2");
        }
    }

    function truncateTickSpacing(int24 tick, int24 tickSpacing) internal pure returns (int24) {
        return ((tick / tickSpacing) * tickSpacing);
    }
}