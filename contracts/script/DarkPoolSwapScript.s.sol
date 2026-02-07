// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {IPoolManager, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IERC20} from "forge-std/interfaces/IERC20.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData) external payable returns (BalanceDelta);
}

interface ICommitStore {
    function commit(bytes32 commitmentHash, bytes32 nullifier) external;
    function commitments(bytes32) external view returns (address user, uint256 amountIn, uint256 minAmountOut, uint256 submitBlock, bool revealed);
    function BATCH_DELAY() external view returns (uint256);
}

contract DarkPoolSwapScript is Script {
    using CurrencyLibrary for Currency;
    
    address constant SWAP_ROUTER = 0xB276FA545ed8848EC49b2a925c970313253B90Ba;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant HOOK = 0x77853497C9dEC9460fb305cbcD80C7DAF4EcDC54;
    
    uint24 constant FEE = 500;
    int24 constant TICK_SPACING = 10;
    uint256 constant SALT = 1115556232;
    
    // Price limit constants
    uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;
    uint160 constant MIN_SQRT_RATIO = 4295128739;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        ICommitStore commitStore = ICommitStore(COMMIT_STORE);
        
        uint256 amountIn = 10 * 1e6; // 10 USDC
        uint256 minAmountOut = 0.004 * 1e18; // 0.004 ETH
        bytes32 commitmentHash = keccak256(abi.encodePacked(amountIn, minAmountOut, SALT));
        bytes32 nullifier = keccak256(abi.encodePacked(commitmentHash, SALT));
        
        console.log("Salt:", SALT);
        console.log("Amount:", amountIn / 1e6, "USDC");
        
        (address storedUser,,, uint256 submitBlock, bool revealed) = commitStore.commitments(commitmentHash);
        
        if (storedUser == address(0)) {
            commitStore.commit(commitmentHash, nullifier);
            console.log("Committed! Wait 10 blocks. Current:", block.number);
            vm.stopBroadcast();
            return;
        }
        
        uint256 revealBlock = submitBlock + commitStore.BATCH_DELAY();
        if (block.number < revealBlock) {
            console.log("Waiting. Current:", block.number, "Target:", revealBlock);
            vm.stopBroadcast();
            return;
        }
        
        if (revealed) {
            console.log("Already revealed! Change SALT.");
            vm.stopBroadcast();
            return;
        }
        
        console.log("Executing swap...");
        
        IERC20(USDC).approve(SWAP_ROUTER, amountIn);
        
        PoolKey memory poolKey = PoolKey({
            currency0: Currency.wrap(address(0)), // ETH
            currency1: Currency.wrap(USDC),       // USDC
            fee: FEE,
            tickSpacing: TICK_SPACING,
            hooks: IHooks(HOOK)
        });
        
        bool zeroForOne = false; // USDC -> ETH (price increases)
        
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: -int256(amountIn),
            sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1 // Fixed!
        });
        
        bytes memory hookData = abi.encode(commitmentHash, SALT, minAmountOut);
        
        BalanceDelta delta = ISwapRouter(SWAP_ROUTER).swap(poolKey, params, hookData);
        
        console.log("SUCCESS!");
        console.log("ETH received:", uint256(int256(delta.amount0())) / 1e18);
        console.log("USDC spent:", uint256(-int256(delta.amount1())) / 1e6);
        
        vm.stopBroadcast();
    }
}