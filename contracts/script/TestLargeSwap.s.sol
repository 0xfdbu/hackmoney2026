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

contract TestLargeSwap is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        uint256 salt = 1770405996000002;
        uint256 amount = 1000000; // 1 USDC
        uint256 minOut = 0;
        
        bytes32 commitment = keccak256(abi.encodePacked(amount, minOut, salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        console.log("Amount:", amount);
        console.log("Salt:", salt);
        console.log("Commitment:", vm.toString(commitment));
        
        // Check commitment
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        console.log("Current user:", user);
        
        if (user == address(0)) {
            console.log("Committing...");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed! Wait 10 blocks...");
            vm.stopBroadcast();
            return;
        }
        
        console.log("Already committed at block:", submitBlock);
        console.log("Current block:", block.number);
        console.log("Can reveal:", ICommitStore(COMMIT_STORE).canReveal(commitment, amount, minOut, salt));
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, amount, minOut, salt)) {
            console.log("Wait for block:", submitBlock + 10);
            vm.stopBroadcast();
            return;
        }
        
        // Try swap
        console.log("Attempting swap...");
        (bool a,) = USDC.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, amount));
        require(a, "Approve failed");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: int256(amount),
            sqrtPriceLimitX96: 0
        });
        
        bytes memory hookData = abi.encode(commitment, salt, minOut);
        
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (bytes memory) {
            console.log("Swap succeeded!");
        } catch Error(string memory reason) {
            console.log("Swap failed:", reason);
        } catch (bytes memory err) {
            console.log("Swap failed with bytes:");
            console.logBytes(err);
        }
        
        vm.stopBroadcast();
    }
}
