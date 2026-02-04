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
            beforeInitialize: true,      // Bit 159 = 1 (address has this)
            afterInitialize: false,      // Bit 158 = 0
            beforeAddLiquidity: false,   // Bit 157 = 0
            afterAddLiquidity: false,    // Bit 156 = 0
            beforeRemoveLiquidity: false,// Bit 155 = 0
            afterRemoveLiquidity: false, // Bit 154 = 0
            beforeSwap: true,            // Bit 153 = 1 (address has this)
            afterSwap: true,             // Bit 152 = 1 (address has this)
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: true,  // Enable since you return int128 in afterSwap
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) { 
        return IHooks.beforeInitialize.selector; 
    }
    
    function beforeSwap(
        address,
        PoolKey calldata,
        SwapParams calldata, 
        bytes calldata hookData
    ) external view override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        (uint[2] memory a, uint[2][2] memory b, uint[2] memory c, uint[5] memory rawInputs) = 
            abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[5]));

        uint[5] memory inputs;
        inputs[0] = rawInputs[2];
        inputs[1] = rawInputs[3];
        inputs[2] = rawInputs[4];
        inputs[3] = rawInputs[0];
        inputs[4] = rawInputs[1];

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
        if (hookData.length >= 416) { 
            (, , , uint[5] memory rawInputs) = abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[5]));
            uint256 signalHash = rawInputs[1]; 
            aggregatedToxicity += signalHash;
            if (aggregatedToxicity > 10000) {
                return (IHooks.afterSwap.selector, int128(100)); 
            }
        }
        return (IHooks.afterSwap.selector, 0);
    }
    
    // Required stubs for other functions (even if permissions are false, keep them for interface)
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
}