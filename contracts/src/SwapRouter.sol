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

// Console logging for debugging (remove in production)
import "forge-std/console.sol";

/**
 * @title SwapRouter
 * @notice Handles swaps through Uniswap v4 PoolManager with proper settlement
 * @dev CRITICAL FIX: Delta signs were backwards - positive delta means we owe (settle), negative means we receive (take)
 */
contract SwapRouter {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;
    using SafeCast for *;

    IPoolManager public immutable manager;
   
    error NotManager();
    error SwapFailed();
    error TransferFailed();
    error SettleFailed();
   
    event SwapExecuted(
        address indexed sender,
        int128 amount0,
        int128 amount1
    );
   
    event DebugDelta(string label, int256 amount);
    event DebugSettle(address currency, address payer, uint256 amount);
    event DebugTake(address currency, address recipient, uint256 amount);

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
        bytes memory data = abi.encode(key, params, hookData, msg.sender);
        bytes memory result = manager.unlock(data);
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

        console.log("=== UNLOCK CALLBACK ===");
        console.log("Sender:", sender);
        console.log("zeroForOne:", params.zeroForOne);
        console.log("amountSpecified:", params.amountSpecified);

        // Execute the swap
        BalanceDelta delta = manager.swap(key, params, hookData);
       
        console.log("Swap Delta0:", delta.amount0());
        console.log("Swap Delta1:", delta.amount1());
       
        // Settle all debts to the PoolManager
        _settleDeltas(key, delta, sender);
       
        emit SwapExecuted(sender, delta.amount0(), delta.amount1());
       
        return abi.encode(delta);
    }
   
    /**
     * @notice Settle all deltas after a swap
     * @dev CRITICAL: In v4, positive delta = we owe (pay/settle), negative delta = they owe us (receive/take)
     */
    function _settleDeltas(PoolKey memory key, BalanceDelta delta, address sender) internal {
        // Handle currency0
        int256 delta0 = manager.currencyDelta(address(this), key.currency0);
        console.log("Currency0 Delta:", delta0);
        
        if (delta0 > 0) {
            // POSITIVE: We owe currency0 to the PoolManager (SETTLE)
            console.log("Settling currency0 (positive delta)");
            _settle(key.currency0, sender, uint256(delta0));
        } else if (delta0 < 0) {
            // NEGATIVE: PoolManager owes us currency0 (TAKE)
            console.log("Taking currency0 (negative delta)");
            _take(key.currency0, sender, uint256(-delta0));
        }
       
        // Handle currency1
        int256 delta1 = manager.currencyDelta(address(this), key.currency1);
        console.log("Currency1 Delta:", delta1);
        
        if (delta1 > 0) {
            // POSITIVE: We owe currency1 to the PoolManager (SETTLE)
            console.log("Settling currency1 (positive delta)");
            _settle(key.currency1, sender, uint256(delta1));
        } else if (delta1 < 0) {
            // NEGATIVE: PoolManager owes us currency1 (TAKE)
            console.log("Taking currency1 (negative delta)");
            _take(key.currency1, sender, uint256(-delta1));
        }
    }
   
    /**
     * @notice Settle a currency debt to the PoolManager
     * @dev For ERC20: transfer to PoolManager, then call settle(Currency)
     */
    function _settle(Currency currency, address payer, uint256 amount) internal {
        emit DebugSettle(Currency.unwrap(currency), payer, amount);
       
        if (amount == 0) return;
       
        if (currency.isAddressZero()) {
            // Settling native ETH
            console.log("Settling ETH:", amount);
            manager.settle{value: amount}();
            console.log("ETH settle success");
        } else {
            // ERC20 settlement
            console.log("Settling ERC20, amount:", amount);
            bool success;
            
            // Step 1: Pull tokens from user to SwapRouter (if not already here)
            uint256 routerBalance = IERC20(Currency.unwrap(currency)).balanceOf(address(this));
            console.log("Router balance before:", routerBalance);
            
            if (routerBalance < amount) {
                uint256 needed = amount - routerBalance;
                console.log("Pulling from payer:", needed);
                success = IERC20(Currency.unwrap(currency)).transferFrom(payer, address(this), needed);
                if (!success) revert TransferFailed();
            }
            
            // Step 2: Transfer from SwapRouter to PoolManager
            console.log("Transferring to PoolManager");
            success = IERC20(Currency.unwrap(currency)).transfer(address(manager), amount);
            if (!success) revert TransferFailed();
            
            // Step 3: Tell PoolManager we've settled using low-level call to avoid interface issues
            console.log("Calling settle(Currency)");
            
            (bool settleSuccess, bytes memory returnData) = address(manager).call(
                abi.encodeWithSelector(bytes4(keccak256("settle(Currency)")), currency)
            );
            
            if (!settleSuccess) {
                console.log("Settle failed!");
                if (returnData.length > 0) {
                    assembly {
                        revert(add(returnData, 32), mload(returnData))
                    }
                }
                revert SettleFailed();
            }
            
            // Decode returned amount (optional check)
            uint256 paid = abi.decode(returnData, (uint256));
            console.log("Settle success, paid:", paid);
        }
    }
   
    /**
     * @notice Take a currency credit from the PoolManager
     */
    function _take(Currency currency, address recipient, uint256 amount) internal {
        emit DebugTake(Currency.unwrap(currency), recipient, amount);
       
        if (amount == 0) return;
        
        console.log("Taking currency:", Currency.unwrap(currency));
        console.log("Amount:", amount);
        console.log("Recipient:", recipient);
        
        manager.take(currency, recipient, amount);
        console.log("Take success");
    }
    
    /**
     * @notice Check balances for debugging
     */
    function checkBalances(Currency currency, address user) external view returns (uint256 routerBalance, uint256 managerBalance, int256 delta) {
        routerBalance = IERC20(Currency.unwrap(currency)).balanceOf(address(this));
        managerBalance = IERC20(Currency.unwrap(currency)).balanceOf(address(manager));
        delta = manager.currencyDelta(address(this), currency);
    }

    receive() external payable {}
}