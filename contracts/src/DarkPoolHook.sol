// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

interface ICommitStore {
    function canReveal(
        bytes32 commitmentHash,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 salt
    ) external view returns (bool);
    
    function reveal(
        bytes32 commitmentHash,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 salt
    ) external;
}

/**
 * @title DarkPoolHook
 * @notice Privacy-preserving DEX using commit-reveal scheme
 * @dev Integrates with CommitStore for verification
 */
contract DarkPoolHook is IHooks {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    IPoolManager public immutable manager;
    ICommitStore public immutable commitStore;
    
    event SwapVerified(
        bytes32 indexed commitmentHash,
        uint256 amountIn,
        uint256 minAmountOut
    );
    
    constructor(IPoolManager _manager, address _commitStore) {
        manager = _manager;
        commitStore = ICommitStore(_commitStore);
    }

    modifier onlyPoolManager() {
        require(msg.sender == address(manager), "Not PoolManager");
        _;
    }

    /**
     * @notice Hook called before swap - verifies commitment from CommitStore
     */
    function beforeSwap(
        address sender,
        PoolKey calldata,
        SwapParams calldata params,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        // Decode hook data: (commitmentHash, salt, minAmountOut)
        (bytes32 commitmentHash, uint256 salt, uint256 minAmountOut) = abi.decode(
            hookData, 
            (bytes32, uint256, uint256)
        );
        
        // Use the actual swap amount from params
        uint256 amountIn = params.amountSpecified > 0 
            ? uint256(params.amountSpecified) 
            : uint256(-params.amountSpecified);
        
        // Verify commitment is valid and can be revealed
        require(
            commitStore.canReveal(commitmentHash, amountIn, minAmountOut, salt),
            "Invalid or premature commitment"
        );
        
        // Mark as revealed in CommitStore
        commitStore.reveal(commitmentHash, amountIn, minAmountOut, salt);
        
        emit SwapVerified(commitmentHash, amountIn, minAmountOut);
        
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
    
    function afterSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external view override onlyPoolManager returns (bytes4, int128) {
        return (IHooks.afterSwap.selector, 0);
    }
    
    // Required hooks (no-ops)
    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }
    
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }
    
    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) 
        external pure returns (bytes4) {
        return IHooks.beforeAddLiquidity.selector;
    }
    
    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) 
        external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }
    
    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) 
        external pure returns (bytes4) {
        return IHooks.beforeRemoveLiquidity.selector;
    }
    
    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) 
        external pure returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA);
    }
    
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) 
        external pure returns (bytes4) {
        return IHooks.beforeDonate.selector;
    }
    
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) 
        external pure returns (bytes4) {
        return IHooks.afterDonate.selector;
    }
}
