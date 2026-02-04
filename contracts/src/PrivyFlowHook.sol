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

    // Boilerplate implementations...
    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) { 
        return IHooks.beforeInitialize.selector; 
    }
    
    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) { 
        return IHooks.afterInitialize.selector; 
    }
    
    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.beforeAddLiquidity.selector; 
    }

    function afterAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata) external pure override returns (bytes4, BalanceDelta) { 
        return (IHooks.afterAddLiquidity.selector, BalanceDeltaLibrary.ZERO_DELTA); 
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata) external pure override returns (bytes4) { 
        return IHooks.beforeRemoveLiquidity.selector; 
    }

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
        // Decode all 5 public signals
        (uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[5] memory rawInputs) = 
            abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[5]));

        // Reorder from snarkjs format [out0, out1, pub0, pub1, pub2] 
        // to verifier format [pub0, pub1, pub2, out0, out1]
        uint[5] memory inputs;
        inputs[0] = rawInputs[2]; // poolBalance0
        inputs[1] = rawInputs[3]; // poolBalance1
        inputs[2] = rawInputs[4]; // toxicityThreshold
        inputs[3] = rawInputs[0]; // valid
        inputs[4] = rawInputs[1]; // aggSignalHash

        (bool success, ) = verifier.staticcall(
            abi.encodeWithSignature("verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[5])", a, b, c, inputs)
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
        // Check if hookData is long enough (13 * 32 bytes = 416 bytes minimum)
        if (hookData.length >= 416) { 
            (, , , uint[5] memory rawInputs) = abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[5]));
            // aggSignalHash is at index 1 in raw snarkjs output, or index 4 in reordered
            uint256 signalHash = rawInputs[1]; 
            aggregatedToxicity += signalHash;
            if (aggregatedToxicity > 10000) {
                return (IHooks.afterSwap.selector, int128(100)); 
            }
        }
        return (IHooks.afterSwap.selector, 0);
    }
}