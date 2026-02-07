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
 * @dev Fixed settlement flow: sync -> transfer -> settle for ERC20
 * @dev Delta logic: negative = we owe (settle), positive = we receive (take)
 */
contract SwapRouter {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;
    using SafeCast for int256;

    IPoolManager public immutable manager;
    
    error NotManager();
    error SwapFailed();
    error TransferFailed();
    error SettleFailed();
    error TakeFailed();
    error ZeroAmount();
    
    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event Settled(address indexed currency, uint256 amount);
    event Taken(address indexed currency, uint256 amount);

    modifier onlyManager() {
        if (msg.sender != address(manager)) revert NotManager();
        _;
    }

    constructor(IPoolManager _manager) {
        manager = _manager;
    }

    /**
     * @notice Execute a swap through the PoolManager
     */
    function swap(
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external payable returns (BalanceDelta delta) {
        bytes memory data = abi.encode(key, params, hookData, msg.sender, msg.value);
        bytes memory result = manager.unlock(data);
        delta = abi.decode(result, (BalanceDelta));
    }

    /**
     * @notice Callback from PoolManager after unlock
     */
    function unlockCallback(bytes calldata data) external onlyManager returns (bytes memory) {
        (
            PoolKey memory key,
            SwapParams memory params,
            bytes memory hookData,
            address sender,
            uint256 ethValue
        ) = abi.decode(data, (PoolKey, SwapParams, bytes, address, uint256));

        console.log("=== UNLOCK CALLBACK ===");
        console.log("Sender:", sender);
        console.log("zeroForOne:", params.zeroForOne);

        // Execute the swap
        BalanceDelta delta = manager.swap(key, params, hookData);
        
        console.log("Raw Delta0:", delta.amount0());
        console.log("Raw Delta1:", delta.amount1());

        // Settle all debts and take all credits
        _settleDeltas(key, delta, sender, ethValue);

        // Calculate amounts for event (convert int128 -> int256 -> uint256)
        uint256 amountIn;
        uint256 amountOut;
        
        if (params.zeroForOne) {
            // USDC -> WETH: amount0 is negative (we pay), amount1 is positive (we receive)
            amountIn = uint256(int256(-delta.amount0()));   // Fixed: int128 -> int256 -> uint256
            amountOut = uint256(int256(delta.amount1()));   // Fixed: int128 -> int256 -> uint256
        } else {
            // WETH -> USDC
            amountIn = uint256(int256(-delta.amount1()));
            amountOut = uint256(int256(delta.amount0()));
        }

        emit SwapExecuted(
            sender,
            Currency.unwrap(params.zeroForOne ? key.currency0 : key.currency1),
            Currency.unwrap(params.zeroForOne ? key.currency1 : key.currency0),
            amountIn,
            amountOut
        );

        return abi.encode(delta);
    }

    /**
     * @notice Settle all deltas after a swap
     * @dev CRITICAL: negative delta = we owe (settle), positive delta = we receive (take)
     */
    function _settleDeltas(
        PoolKey memory key, 
        BalanceDelta delta, 
        address sender,
        uint256 ethValue
    ) internal {
        // Get actual deltas from PoolManager (more reliable than swap return value)
        int256 delta0 = manager.currencyDelta(address(this), key.currency0);
        int256 delta1 = manager.currencyDelta(address(this), key.currency1);
        
        console.log("Currency0 Delta:", delta0);
        console.log("Currency1 Delta:", delta1);

        // Handle currency0
        if (delta0 < 0) {
            // NEGATIVE: We owe currency0 (SETTLE)
            console.log("Settling currency0");
            _settle(key.currency0, sender, uint256(-delta0), ethValue);
        } else if (delta0 > 0) {
            // POSITIVE: We receive currency0 (TAKE)
            console.log("Taking currency0");
            _take(key.currency0, sender, uint256(delta0));
        }
        
        // Handle currency1
        if (delta1 < 0) {
            // NEGATIVE: We owe currency1 (SETTLE)
            console.log("Settling currency1");
            _settle(key.currency1, sender, uint256(-delta1), ethValue);
        } else if (delta1 > 0) {
            // POSITIVE: We receive currency1 (TAKE)
            console.log("Taking currency1");
            _take(key.currency1, sender, uint256(delta1));
        }
    }

    /**
     * @notice Settle a currency debt to the PoolManager
     */
    function _settle(
        Currency currency, 
        address payer, 
        uint256 amount,
        uint256 ethValue
    ) internal {
        if (amount == 0) revert ZeroAmount();

        if (currency.isAddressZero()) {
            // Native ETH settlement
            if (ethValue < amount) revert SettleFailed();
            manager.settle{value: amount}();
            emit Settled(address(0), amount);
        } else {
            // ERC20 settlement
            address token = Currency.unwrap(currency);
            
            // Step 1: Sync
            manager.sync(currency);
            
            // Step 2: Pull from user if needed
            uint256 routerBalance = IERC20(token).balanceOf(address(this));
            if (routerBalance < amount) {
                uint256 needed = amount - routerBalance;
                // Fixed: Remove 'bool' to avoid shadowing
                bool success = IERC20(token).transferFrom(payer, address(this), needed);
                if (!success) revert TransferFailed();
            }
            
            // Step 3: Transfer to PoolManager
            // Fixed: Remove 'bool' declaration, reuse variable or just check return
            bool success2 = IERC20(token).transfer(address(manager), amount);
            if (!success2) revert TransferFailed();
            
            // Step 4: Settle (no arguments)
            manager.settle();
            
            emit Settled(token, amount);
        }
    }

    /**
     * @notice Take a currency credit from the PoolManager
     */
    function _take(
        Currency currency, 
        address recipient, 
        uint256 amount
    ) internal {
        if (amount == 0) return;
        manager.take(currency, recipient, amount);
        emit Taken(Currency.unwrap(currency), amount);
    }

    receive() external payable {}
}