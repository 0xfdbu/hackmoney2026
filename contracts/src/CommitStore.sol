// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title CommitStore
 * @notice Stores commitments for dark pool swaps
 * @dev Users commit here first, then execute swap through PoolManager after delay
 */
contract CommitStore {
    struct Commitment {
        address user;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 submitBlock;
        bool revealed;
    }
    
    mapping(bytes32 => Commitment) public commitments;
    mapping(bytes32 => bool) public nullifierSpent;
    
    uint256 public constant BATCH_DELAY = 10;
    
    event CommitSubmitted(
        bytes32 indexed commitmentHash,
        bytes32 indexed nullifier,
        address indexed user,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 revealBlock
    );
    
    event CommitRevealed(
        bytes32 indexed commitmentHash,
        bytes32 indexed nullifier,
        uint256 amountIn,
        uint256 minAmountOut
    );
    
    /**
     * @notice Submit a commitment for a future swap
     * @param commitmentHash keccak256(amountIn, minAmountOut, salt)
     * @param nullifier Unique identifier to prevent double-spending
     */
    function commit(
        bytes32 commitmentHash,
        bytes32 nullifier
    ) external {
        require(commitmentHash != bytes32(0), "Empty commitment");
        require(!nullifierSpent[nullifier], "Nullifier spent");
        require(commitments[commitmentHash].submitBlock == 0, "Commitment exists");
        
        // We don't store the actual amount yet - it's hidden in the hash
        // User will reveal it later when executing the swap
        commitments[commitmentHash] = Commitment({
            user: msg.sender,
            amountIn: 0, // Will be filled on reveal
            minAmountOut: 0, // Will be filled on reveal
            submitBlock: block.number,
            revealed: false
        });
        
        nullifierSpent[nullifier] = true;
        
        emit CommitSubmitted(
            commitmentHash,
            nullifier,
            msg.sender,
            0, // Hidden
            0, // Hidden
            block.number + BATCH_DELAY
        );
    }
    
    /**
     * @notice Verify a commitment can be revealed
     * @param commitmentHash The commitment hash
     * @param amountIn The committed amount
     * @param minAmountOut The committed min output
     * @param salt The secret salt
     */
    function canReveal(
        bytes32 commitmentHash,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 salt
    ) external view returns (bool) {
        Commitment storage c = commitments[commitmentHash];
        
        if (c.submitBlock == 0) return false;
        if (c.revealed) return false;
        if (block.number < c.submitBlock + BATCH_DELAY) return false;
        
        // Verify the hash matches
        bytes32 computedHash = keccak256(abi.encodePacked(amountIn, minAmountOut, salt));
        if (computedHash != commitmentHash) return false;
        
        return true;
    }
    
    /**
     * @notice Mark a commitment as revealed
     * @param commitmentHash The commitment hash
     * @param amountIn The committed amount
     * @param minAmountOut The committed min output  
     * @param salt The secret salt
     */
    function reveal(
        bytes32 commitmentHash,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 salt
    ) external {
        Commitment storage c = commitments[commitmentHash];
        
        require(c.submitBlock > 0, "Unknown commitment");
        require(!c.revealed, "Already revealed");
        require(block.number >= c.submitBlock + BATCH_DELAY, "Too early");
        
        // Verify the hash matches
        bytes32 computedHash = keccak256(abi.encodePacked(amountIn, minAmountOut, salt));
        require(computedHash == commitmentHash, "Invalid reveal");
        
        c.revealed = true;
        c.amountIn = amountIn;
        c.minAmountOut = minAmountOut;
        
        emit CommitRevealed(commitmentHash, bytes32(0), amountIn, minAmountOut);
    }
}
