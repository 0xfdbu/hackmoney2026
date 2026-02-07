// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";

interface ISwapRouter {
    function swap(PoolKey calldata key, SwapParams calldata params, bytes calldata hookData)
        external payable returns (BalanceDelta);
}

interface ICommitStore {
    function commit(bytes32, bytes32) external;
    function canReveal(bytes32, uint256, uint256, uint256) external view returns (bool);
    function commitments(bytes32) external view returns (address, uint256, uint256, uint256, bool);
}

contract WorkingSwap is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        
        // Generate a new random salt
        uint256 salt = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)));
        uint256 amount = 100000; // 0.1 USDC
        uint256 minOut = 0;      // 100% slippage
        
        bytes32 commitment = keccak256(abi.encodePacked(amount, minOut, salt));
        bytes32 nullifier = keccak256(abi.encodePacked(salt));
        
        console.log("=== PRIVYFLOW SWAP ===");
        console.log("Salt:", salt);
        console.log("Commitment:", vm.toString(commitment));
        
        // Check if already committed
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        
        if (user == address(0)) {
            console.log("\nStep 1: Committing...");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("Wait 10 blocks, then run again to reveal");
            vm.stopBroadcast();
            return;
        }
        
        console.log("\nStep 2: Revealing...");
        console.log("Committed at block:", submitBlock);
        console.log("Current block:", block.number);
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, amount, minOut, salt)) {
            console.log("Cannot reveal yet. Wait for block:", submitBlock + 10);
            vm.stopBroadcast();
            return;
        }
        
        console.log("\nStep 3: Executing swap...");
        
        // Approve USDC
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
        
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (BalanceDelta d) {
            console.log("\nSUCCESS!");
            console.log("USDC sent:", d.amount0());
            console.log("ETH received:", d.amount1());
        } catch Error(string memory r) {
            console.log("\nFAILED:", r);
        } catch (bytes memory r) {
            console.log("\nFAILED with error:");
            console.logBytes(r);
        }
        
        vm.stopBroadcast();
    }
}
