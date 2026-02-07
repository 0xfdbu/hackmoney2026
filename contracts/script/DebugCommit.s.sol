// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";

interface ICommitStore {
    function commitments(bytes32) external view returns (address user, uint256 amountIn, uint256 minAmountOut, uint256 submitBlock, bool revealed);
    function canReveal(bytes32 commitmentHash, uint256 amountIn, uint256 minAmountOut, uint256 salt) external view returns (bool);
}

contract DebugCommit is Script {
    address constant COMMIT_STORE = 0xdC81d28a1721fcdE86d79Ce26ba3b0bEf24C116C;
    
    function run() external view {
        uint256 salt = 1770405996000002;
        uint256 amount = 1000000;
        uint256 minOut = 0;
        bytes32 commitment = keccak256(abi.encodePacked(amount, minOut, salt));
        
        console.log("Commitment:", vm.toString(commitment));
        
        (address user, uint256 amountIn, uint256 minAmountOut, uint256 submitBlock, bool revealed) = 
            ICommitStore(COMMIT_STORE).commitments(commitment);
        
        console.log("User:", user);
        console.log("AmountIn:", amountIn);
        console.log("MinAmountOut:", minAmountOut);
        console.log("SubmitBlock:", submitBlock);
        console.log("Revealed:", revealed);
        console.log("Current block:", block.number);
        console.log("Can reveal:", ICommitStore(COMMIT_STORE).canReveal(commitment, amount, minOut, salt));
    }
}
