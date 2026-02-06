// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Hooks} from "v4-core/libraries/Hooks.sol";
import {IPoolManager, SwapParams, ModifyLiquidityParams} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "v4-core/types/BeforeSwapDelta.sol";

contract DarkPoolHook is IHooks {
    using BeforeSwapDeltaLibrary for BeforeSwapDelta;

    IPoolManager public immutable manager;
    address public immutable verifier;
    
    struct Batch {
        bytes32[] commitments;
        bool settled;
        uint256 clearingPrice;
        uint256 settledAt;
    }
    
    mapping(uint256 => Batch) public batches;
    mapping(bytes32 => bool) public nullifierSpent;
    uint256 public currentBatchId;
    uint256 public constant BATCH_DURATION = 10;
    
    event CommitSubmitted(uint256 indexed batchId, bytes32 commitment, bytes32 nullifier);
    event BatchSettled(uint256 indexed batchId, uint256 clearingPrice);
    
    constructor(IPoolManager _manager, address _verifier) {
        manager = _manager;
        verifier = _verifier;
        currentBatchId = 1;
    }

    modifier onlyPoolManager() {
        require(msg.sender == address(manager), "Not PoolManager");
        _;
    }

    // Hook permissions are determined by the LEAST SIGNIFICANT 14 bits of the address:
    // beforeInitialize (bit 13 = 0x2000) | beforeSwap (bit 7 = 0x0080)
    // Target suffix: 0x2080
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: true,      // Bit 159 = 1
            afterInitialize: false,      // Bit 158 = 0
            beforeAddLiquidity: false,   // Bit 157 = 0
            afterAddLiquidity: false,    // Bit 156 = 0
            beforeRemoveLiquidity: false,// Bit 155 = 0
            afterRemoveLiquidity: false, // Bit 154 = 0
            beforeSwap: true,            // Bit 153 = 1  <-- CRITICAL
            afterSwap: false,            // Bit 152 = 0
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }

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

    function beforeSwap(
        address,
        PoolKey calldata,
        SwapParams calldata,
        bytes calldata hookData
    ) external override onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        (
            uint[2] memory a,
            uint[2][2] memory b,
            uint[2] memory c,
            uint[7] memory signals
        ) = abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[7]));

        // Reorder signals for verifier (verifier expects circom's natural order):
        // Verifier expects: [batch_id, max_price_impact, oracle_price, commitment, nullifier, batch_id_out, valid]
        // Frontend sends:   [commitment, nullifier, batch_id, valid, batch_id_out, max_price_impact, oracle_price]
        uint[7] memory verifierSignals;
        verifierSignals[0] = signals[2]; // batch_id
        verifierSignals[1] = signals[5]; // max_price_impact
        verifierSignals[2] = signals[6]; // oracle_price
        verifierSignals[3] = signals[0]; // commitment
        verifierSignals[4] = signals[1]; // nullifier
        verifierSignals[5] = signals[4]; // batch_id_out
        verifierSignals[6] = signals[3]; // valid

        (bool success, bytes memory returnData) = verifier.staticcall(
            abi.encodeWithSignature(
                "verifyProof(uint256[2],uint256[2][2],uint256[2],uint256[7])",
                a, b, c, verifierSignals
            )
        );
        require(success, "Verifier call failed");
        require(returnData.length > 0, "No return data from verifier");
        bool proofValid = abi.decode(returnData, (bool));
        require(proofValid, "Invalid ZK proof");
        
        // Check valid constraint (now at index 6 after reordering)
        require(verifierSignals[6] == 1, "Invalid constraints");

        uint256 batchId = verifierSignals[0]; // batch_id
        bytes32 commitment = bytes32(verifierSignals[3]);
        bytes32 nullifier = bytes32(verifierSignals[4]);

        require(!nullifierSpent[nullifier], "Nullifier already spent");
        nullifierSpent[nullifier] = true;
        batches[batchId].commitments.push(commitment);
        
        emit CommitSubmitted(batchId, commitment, nullifier);
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
    
    function settleBatch(uint256 clearingPrice) external {
        Batch storage batch = batches[currentBatchId];
        require(!batch.settled, "Already settled");
        require(block.number >= currentBatchId + BATCH_DURATION, "Batch not ready");
        require(batch.commitments.length > 0, "Empty batch");
        
        batch.clearingPrice = clearingPrice;
        batch.settled = true;
        batch.settledAt = block.number;
        
        emit BatchSettled(currentBatchId, clearingPrice);
        currentBatchId++;
    }
    
    function getBatchInfo(uint256 batchId) external view returns (
        uint256 commitmentCount,
        bool settled,
        uint256 clearingPrice,
        uint256 settledAt
    ) {
        Batch storage b = batches[batchId];
        return (b.commitments.length, b.settled, b.clearingPrice, b.settledAt);
    }
}
