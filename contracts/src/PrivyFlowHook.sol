// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol"; 
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

contract PrivyFlowHook is IHooks {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    IPoolManager public immutable manager;
    address public immutable verifier;
    uint256 private aggregatedToxicity;

    constructor(IPoolManager _manager, address _verifier) {
        manager = _manager;
        verifier = _verifier;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(manager)) revert("Not PoolManager");
        _;
    }

    // REMOVED 'override' - this is now a custom helper for your deployment script
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: true,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    // --- Boilerplate implementations matched to your IHooks.sol ---

    // FIXED: Signatures matched to your compiler error (removed hookData)
    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) { 
        return IHooks.beforeInitialize.selector; 
    }
    
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) { 
        return IHooks.afterInitialize.selector; 
    }
    
    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.beforeAddLiquidity.selector; 
    }

    // FIXED: Added BalanceDelta return type
    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure override returns (bytes4, BalanceDelta) { 
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA); 
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.beforeRemoveLiquidity.selector; 
    }

    // FIXED: Added BalanceDelta return type
    function afterRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure override returns (bytes4, BalanceDelta) { 
        return (IHooks.afterRemoveLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA); 
    }
    
    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.beforeDonate.selector; 
    }
    
    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.afterDonate.selector; 
    }

    // --- Core Logic ---

    function beforeSwap(
        address,
        PoolKey calldata,
        SwapParams calldata, 
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        (uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[3] memory inputs) = 
            abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[3]));

        (bool success, ) = verifier.staticcall(
            abi.encodeWithSignature("verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[3])", a, b, c, inputs)
        );
        require(success, "Invalid ZK proof");

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    function afterSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        BalanceDelta,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, int128) {
        if (hookData.length >= 224) { 
            (, , , uint[3] memory inputs) = abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[3]));
            uint256 signalHash = inputs[2];
            aggregatedToxicity += signalHash;
            if (aggregatedToxicity > 10000) return (IHooks.afterSwap.selector, int128(100)); 
        }
        return (IHooks.afterSwap.selector, 0);
    }
}