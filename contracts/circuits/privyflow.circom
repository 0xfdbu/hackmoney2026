pragma circom 2.1.6;

include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";
include "circomlib/circuits/poseidon.circom";

template PrivyFlowIntent() {
    // Private inputs (hidden from onchain)
    signal input amountIn;
    signal input minAmountOut;
    signal input userSignal;  // Private toxicity metric (e.g., user-computed imbalance)

    // Public inputs (verifiable onchain)
    signal input poolBalance0;
    signal input poolBalance1;
    signal input toxicityThreshold;

    signal output valid;         // 1 if intent is valid and non-toxic
    signal output aggSignalHash; // Poseidon hash for private aggregation

    // Check amountIn > 0
    component gtZero = GreaterThan(252);
    gtZero.in[0] <== amountIn;
    gtZero.in[1] <== 0;
    gtZero.out === 1;

    // Rough execution quality: expectedOut >= minAmountOut (simplified price impact for zeroForOne swap)
    component priceImpact = GreaterEqThan(252);
    priceImpact.in[0] <== (amountIn * poolBalance1) / (poolBalance0 + amountIn);
    priceImpact.in[1] <== minAmountOut;
    priceImpact.out === 1;

    // Non-toxic check: userSignal < toxicityThreshold
    component nonToxic = LessThan(252);
    nonToxic.in[0] <== userSignal;
    nonToxic.in[1] <== toxicityThreshold;
    nonToxic.out === 1;

    // Combine all validations (AND logic)
    component and1 = AND();
    and1.a <== gtZero.out;
    and1.b <== priceImpact.out;

    component and2 = AND();
    and2.a <== and1.out;
    and2.b <== nonToxic.out;
    valid <== and2.out;

    // Poseidon hash of userSignal for onchain aggregation (irreversible, privacy-preserving)
    component hasher = Poseidon(1);
    hasher.inputs[0] <== userSignal;
    aggSignalHash <== hasher.out;
}

component main { public [poolBalance0, poolBalance1, toxicityThreshold] } = PrivyFlowIntent();