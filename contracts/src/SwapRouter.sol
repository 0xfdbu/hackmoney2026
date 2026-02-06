// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPoolManager, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {SafeCast} from "v4-core/libraries/SafeCast.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

/**
 * @title SwapRouter
 * @notice Handles swaps through Uniswap v4 PoolManager with proper settlement
 * @dev Follows the pattern from v4-periphery: settle all debts in callback
 */
contract SwapRouter {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;
    using SafeCast for *;

    IPoolManager public immutable manager;
    
    error NotManager();
    error SwapFailed();
    error DeltaNotSettled();
    
    event SwapExecuted(
        address indexed sender,
        int128 amount0,
        int128 amount1
    );

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    modifier onlyManager() {
        if (msg.sender != address(manager)) revert NotManager();
        _;
    }

    /**
     * @notice Execute a swap through the PoolManager
     */
    function swap(
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external payable returns (BalanceDelta) {
        // Encode the full swap data for the callback
        bytes memory data = abi.encode(key, params, hookData, msg.sender);
        
        // Call unlock - the callback will handle everything
        bytes memory result = manager.unlock(data);
        
        // Return the delta from the callback result
        return abi.decode(result, (BalanceDelta));
    }

    /**
     * @notice Callback from PoolManager after unlock
     */
    function unlockCallback(bytes calldata data) external onlyManager returns (bytes memory) {
        (
            PoolKey memory key,
            SwapParams memory params,
            bytes memory hookData,
            address sender
        ) = abi.decode(data, (PoolKey, SwapParams, bytes, address));

        // Execute the swap
        BalanceDelta delta = manager.swap(key, params, hookData);
        
        // Settle all debts to the PoolManager
        _settleDeltas(key, delta, sender);
        
        emit SwapExecuted(sender, delta.amount0(), delta.amount1());
        
        // Return the delta for the outer function
        return abi.encode(delta);
    }
    
    /**
     * @notice Settle all deltas after a swap
     */
    function _settleDeltas(PoolKey memory key, BalanceDelta delta, address sender) internal {
        // Handle currency0
        int256 delta0 = manager.currencyDelta(address(this), key.currency0);
        if (delta0 < 0) {
            // We owe currency0 to the PoolManager
            _settle(key.currency0, sender, uint256(-delta0));
        } else if (delta0 > 0) {
            // PoolManager owes us currency0
            _take(key.currency0, sender, uint256(delta0));
        }
        
        // Handle currency1
        int256 delta1 = manager.currencyDelta(address(this), key.currency1);
        if (delta1 < 0) {
            // We owe currency1 to the PoolManager
            _settle(key.currency1, sender, uint256(-delta1));
        } else if (delta1 > 0) {
            // PoolManager owes us currency1
            _take(key.currency1, sender, uint256(delta1));
        }
    }
    
    /**
     * @notice Settle a currency debt to the PoolManager
     */
    function _settle(Currency currency, address payer, uint256 amount) internal {
        if (amount == 0) return;
        
        manager.sync(currency);
        
        if (currency.isAddressZero()) {
            // Settling native ETH
            manager.settle{value: amount}();
        } else {
            // Settling ERC20 - MUST transfer directly to PoolManager
            if (payer != address(this)) {
                IERC20(Currency.unwrap(currency)).transferFrom(payer, address(manager), amount);
            } else {
                IERC20(Currency.unwrap(currency)).transfer(address(manager), amount);
            }
            manager.settle();
        }
    }
    
    /**
     * @notice Take a currency credit from the PoolManager
     */
    function _take(Currency currency, address recipient, uint256 amount) internal {
        if (amount == 0) return;
        manager.take(currency, recipient, amount);
    }

    receive() external payable {}
}
