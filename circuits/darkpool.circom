pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/gates.circom";

template DarkPoolCommit() {
    // === PRIVATE INPUTS ===
    signal input amount_in;
    signal input min_amount_out;
    signal input salt;
    signal input private_key;
    
    // === PUBLIC INPUTS ===
    signal input batch_id;
    signal input max_price_impact;
    signal input oracle_price;
    
    // === OUTPUTS (all public) ===
    signal output commitment;
    signal output nullifier;
    signal output batch_id_out;  // Explicitly output batch_id
    signal output valid;
    
    // Pass batch_id through to output
    batch_id_out <== batch_id;
    
    // Constraint 1: Amount > 0
    component gt_zero = GreaterThan(252);
    gt_zero.in[0] <== amount_in;
    gt_zero.in[1] <== 0;
    
    // Constraint 2: Slippage check
    signal price_adjusted <== oracle_price * (10000 - max_price_impact);
    signal expected_out <== amount_in * price_adjusted;
    
    component slippage_ok = GreaterEqThan(252);
    slippage_ok.in[0] <== min_amount_out * 10000;
    slippage_ok.in[1] <== expected_out;
    
    // Constraint 3: Commitment
    component commit = Poseidon(2);
    commit.inputs[0] <== amount_in;
    commit.inputs[1] <== salt;
    commitment <== commit.out;
    
    // Constraint 4: Nullifier (includes batch_id)
    component nullif = Poseidon(2);
    nullif.inputs[0] <== private_key;
    nullif.inputs[1] <== batch_id;
    nullifier <== nullif.out;
    
    // Constraint 5: Valid
    component and_gate = AND();
    and_gate.a <== gt_zero.out;
    and_gate.b <== slippage_ok.out;
    valid <== and_gate.out;
}

component main { public [batch_id, max_price_impact, oracle_price] } = DarkPoolCommit();
