import * as snarkjs from 'snarkjs';
import fs from 'fs';

const vKey = JSON.parse(fs.readFileSync('../circuits/verification_key.json'));

const proof = {
    pi_a: [
        "11609564415724853034419450650815427268891337242322978396807053345782589373696",
        "16361470067510589106977907297011702978225554100753127321881610382437392598794",
        "1"
    ],
    pi_b: [
        [
            "7749040274252958025173268815418201621654537586404334577724487937916282775420",
            "8985648792984657405819859826313176981196217307008036698283655081582755421741"
        ],
        [
            "18328130586283664996398902313462678831804371129516066631975501348972341433048",
            "13881050112530180123881961406917304806079564490835131205469176579348634622120"
        ],
        ["1", "0"]
    ],
    pi_c: [
        "7238302260638527072224446170363892507722524880496193975743482698772517740936",
        "9672733582736525090582542746366377292859987991974323754099850465276411893592",
        "1"
    ],
    protocol: "groth16",
    curve: "bn128"
};

// Values from circuit outputs
const values = {
    commitment: "13468043774493541282573903797802325966421488021005027815126650173264005873332",
    nullifier: "14969509321192296083583858150834406960669382495771853255563273696969058906816",
    batch_id: "1",
    valid: "1",
    batch_id_out: "1",
    max_price_impact: "10000",
    oracle_price: "200000000000"
};

// Order 1: Circom declaration order (public inputs first, then outputs)
const order1 = [values.batch_id, values.max_price_impact, values.oracle_price, values.commitment, values.nullifier, values.batch_id_out, values.valid];

// Order 2: snarkjs fullProve output order
const order2 = [values.commitment, values.nullifier, values.batch_id, values.valid, values.batch_id_out, values.max_price_impact, values.oracle_price];

console.log("Order 1 (circom declaration):", order1);
const result1 = await snarkjs.groth16.verify(vKey, order1, proof);
console.log("Result:", result1);

console.log("\nOrder 2 (snarkjs output):", order2);
const result2 = await snarkjs.groth16.verify(vKey, order2, proof);
console.log("Result:", result2);
