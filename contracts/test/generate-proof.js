const snarkjs = require('snarkjs');
const fs = require('fs');
const path = require('path');

async function generateProof() {
    const wasmPath = path.join(__dirname, '../../circuits/darkpool_js/darkpool.wasm');
    const zkeyPath = path.join(__dirname, '../../circuits/darkpool_final.zkey');
    
    const input = {
        amount_in: "1000000000000",
        min_amount_out: "1",
        salt: "937143709",
        private_key: "958316953",
        batch_id: "1",
        max_price_impact: "10000",
        oracle_price: "200000000000"
    };
    
    console.log("Generating proof with input:", input);
    
    try {
        const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath);
        
        console.log("\n=== PROOF GENERATED ===");
        console.log("\npi_a:", JSON.stringify(proof.pi_a.slice(0, 2)));
        console.log("pi_b:", JSON.stringify([proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)]));
        console.log("pi_c:", JSON.stringify(proof.pi_c.slice(0, 2)));
        console.log("publicSignals:", JSON.stringify(publicSignals));
        
        // Verify locally first
        const vKey = JSON.parse(fs.readFileSync(path.join(__dirname, '../../circuits/verification_key.json')));
        const verified = await snarkjs.groth16.verify(vKey, publicSignals, proof);
        console.log("\nLocal verification:", verified);
        
        // Save for Foundry
        const output = {
            pi_a: proof.pi_a.slice(0, 2),
            pi_b: [proof.pi_b[0].slice(0, 2), proof.pi_b[1].slice(0, 2)],
            pi_c: proof.pi_c.slice(0, 2),
            publicSignals: publicSignals
        };
        
        fs.writeFileSync(path.join(__dirname, 'proof.json'), JSON.stringify(output, null, 2));
        console.log("\nSaved to contracts/test/proof.json");
        
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

generateProof();
