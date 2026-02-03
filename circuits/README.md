cd ~/Desktop/Hackmoney2026/circuits

# Working PTAU download (active as of February 2026 from Polygon zkEVM repo)
wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_16.ptau -O build/powersOfTau28_hez_final_16.ptau

# Phase 1: Circuit-specific zkey
snarkjs groth16 setup build/privacyflow.r1cs build/powersOfTau28_hez_final_16.ptau build/privacyflow_0000.zkey

# Phase 2: Contribute randomness (demo — use your own entropy string)
echo "privyflow-hackmoney2026-syv-entropy" | snarkjs zkey contribute build/privacyflow_0000.zkey build/privacyflow_final.zkey --name="Syv Contribution" -v

# Export Solidity verifier contract
snarkjs zkey export solidityverifier build/privacyflow_final.zkey ../contracts/src/Groth16Verifier.sol