// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external payable returns (bytes memory);
}

interface ICommitStore {
    function canReveal(bytes32, uint256, uint256, uint256) external view returns (bool);
    function commit(bytes32, bytes32) external;
    function commitments(bytes32) external view returns (address, uint256, uint256, uint256, bool);
}

contract ExecuteSwapUSDC is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    uint160 constant MIN_SQRT_PRICE = 4295128739;
    
    uint256 constant SWAP_AMOUNT = 1_000_000; // 1 USDC
    uint256 constant MIN_OUT = 0;
    uint256 constant SALT = 48208200747286979484880102624422250187739261721973404144477334400866962567443;
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        uint256 salt = SALT;
        
        bytes32 commitment = keccak256(abi.encodePacked(SWAP_AMOUNT, MIN_OUT, salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        console.log("=== USDC -> WETH SWAP ===");
        console.log("Amount:", SWAP_AMOUNT, "(1 USDC)");
        console.log("Salt:", salt);
        console.log("Commitment:", vm.toString(commitment));
        console.log("");
        
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        
        if (user == address(0)) {
            console.log("PHASE 1: COMMITTING");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("=== SAVE THIS SALT ===");
            console.log(salt);
            console.log("======================");
            vm.stopBroadcast();
            return;
        }
        
        console.log("PHASE 2: REVEALING");
        console.log("Committed at block:", submitBlock);
        console.log("Current block:", block.number);
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, SWAP_AMOUNT, MIN_OUT, salt)) {
            console.log("Wait more blocks");
            vm.stopBroadcast();
            return;
        }
        
        // Approve USDC
        (bool approved,) = USDC.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, SWAP_AMOUNT));
        require(approved, "USDC approve failed");
        console.log("USDC approved");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // USDC -> WETH (zeroForOne = true, price goes DOWN)
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: int256(SWAP_AMOUNT),
            sqrtPriceLimitX96: MIN_SQRT_PRICE + 1
        });
        
        bytes memory hookData = abi.encode(commitment, salt, MIN_OUT);
        
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (bytes memory) {
            console.log("SWAP SUCCESSFUL!");
        } catch Error(string memory reason) {
            console.log("SWAP FAILED:", reason);
        } catch (bytes memory err) {
            console.log("SWAP FAILED:");
            console.logBytes(err);
        }
        
        vm.stopBroadcast();
    }
}
