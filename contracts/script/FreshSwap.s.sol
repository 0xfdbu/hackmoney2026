// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import {IPoolManager, PoolKey, SwapParams} from "v4-core/interfaces/IPoolManager.sol";
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
    function nullifierSpent(bytes32) external view returns (bool);
}

contract FreshSwapScript is Script {
    address constant ROUTER = 0x36b42E07273CD8ECfF1125bF15771AE356F085B1;
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    address constant HOOK = 0x1846217Bae61BF26612BD8d9a64b970d525B4080;
    address constant USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address constant WETH = 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14;
    
    // Use a different salt to create a fresh commitment
    uint256 constant SALT = 1770405996000001;
    uint256 constant AMOUNT = 100000; // 0.1 USDC
    uint256 constant MINOUT = 0;      // 100% slippage
    
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        
        bytes32 commitment = keccak256(abi.encodePacked(AMOUNT, MINOUT, SALT));
        bytes32 nullifier = keccak256(abi.encodePacked(SALT));
        
        console.log("Salt:", SALT);
        console.log("Commitment:", vm.toString(commitment));
        
        // Check if already committed
        (address user,,, uint256 submitBlock,) = ICommitStore(COMMIT_STORE).commitments(commitment);
        
        if (user == address(0)) {
            if (ICommitStore(COMMIT_STORE).nullifierSpent(nullifier)) {
                console.log("Nullifier already spent!");
                vm.stopBroadcast();
                return;
            }
            console.log("Committing...");
            ICommitStore(COMMIT_STORE).commit(commitment, nullifier);
            console.log("Committed at block:", block.number);
            console.log("Wait until block:", block.number + 10);
            vm.stopBroadcast();
            return;
        }
        
        console.log("Already committed at block:", submitBlock);
        console.log("Current block:", block.number);
        
        if (!ICommitStore(COMMIT_STORE).canReveal(commitment, AMOUNT, MINOUT, SALT)) {
            console.log("Cannot reveal yet. Wait for block:", submitBlock + 10);
            vm.stopBroadcast();
            return;
        }
        
        console.log("Revealing...");
        
        // Approve USDC
        (bool a,) = USDC.call(abi.encodeWithSelector(0x095ea7b3, ROUTER, AMOUNT));
        require(a, "Approve failed");
        
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });
        
        // Use sqrtPriceLimitX96 = 0 for no limit
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: int256(AMOUNT),
            sqrtPriceLimitX96: 0  // No price limit
        });
        
        bytes memory hookData = abi.encode(commitment, SALT, MINOUT);
        
        try ISwapRouter(ROUTER).swap(key, params, hookData) returns (BalanceDelta d) {
            console.log("SUCCESS!");
            console.log("amount0:", d.amount0());
            console.log("amount1:", d.amount1());
        } catch Error(string memory r) {
            console.log("FAILED:", r);
        } catch (bytes memory r) {
            console.log("FAILED with bytes:");
            console.logBytes(r);
        }
        
        vm.stopBroadcast();
    }
}
