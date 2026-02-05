wget https://storage.googleapis.com/zkevm/ptau/powersOfTau28_hez_final_12.ptau -O pot12_final.ptau

# 1. Compile the circuit
circom darkpool.circom --r1cs --wasm --sym -l .

# 2. Trusted setup (Groth16)
snarkjs groth16 setup darkpool.r1cs pot12_final.ptau darkpool_0000.zkey

# 3. Add randomness (contribution)
snarkjs zkey contribute darkpool_0000.zkey darkpool_final.zkey --name="Hackathon" -v -e="hackathon2026"

# 4. Export verification key (JSON)
snarkjs zkey export verificationkey darkpool_final.zkey verification_key.json

# 5. Export Solidity verifier (for your hook)
snarkjs zkey export solidityverifier darkpool_final.zkey ../contracts/src/DarkPoolVerifier.sol

# 6. Copy files to frontend public folder (create if doesn't exist)
mkdir -p ../frontend/public
cp darkpool_js/darkpool.wasm ../frontend/public/
cp darkpool_final.zkey ../frontend/public/
cp verification_key.json ../frontend/public/

echo "✅ Circuit compiled and files ready!"


``` # 1. Compile the circuit
circom darkpool.circom --r1cs --wasm --sym -l .

# 2. Trusted setup (Groth16)
snarkjs groth16 setup darkpool.r1cs pot12_final.ptau darkpool_0000.zkey

# 3. Add randomness (contribution)
snarkjs zkey contribute darkpool_0000.zkey darkpool_final.zkey --name="Hackathon" -v -e="hackathon2026"

# 4. Export verification key (JSON)
snarkjs zkey export verificationkey darkpool_final.zkey verification_key.json

# 5. Export Solidity verifier (for your hook)
snarkjs zkey export solidityverifier darkpool_final.zkey ../contracts/src/DarkPoolVerifier.sol

# 6. Copy files to frontend public folder (create if doesn't exist)
mkdir -p ../frontend/public
cp darkpool_js/darkpool.wasm ../frontend/public/
cp darkpool_final.zkey ../frontend/public/
cp verification_key.json ../frontend/public/

echo "✅ Circuit compiled and files ready!"
template instances: 77
non-linear constraints: 995
linear constraints: 556
public inputs: 3
private inputs: 4
public outputs: 3
wires: 1557
labels: 2070
Written successfully: ./darkpool.r1cs
Written successfully: ./darkpool.sym
Written successfully: ./darkpool_js/darkpool.wasm
Everything went okay
[INFO]  snarkJS: Reading r1cs
[INFO]  snarkJS: Reading tauG1
[INFO]  snarkJS: Reading tauG2
[INFO]  snarkJS: Reading alphatauG1
[INFO]  snarkJS: Reading betatauG1
[INFO]  snarkJS: Circuit hash: 
                03b24fd3 59989517 3c07396e 0f58a776
                1e336238 e40e56f6 7c72837d e5d6580a
                69d42af9 56e5ce79 f839de92 195664d1
                a3fd4451 23609dd5 a19724f9 ad3123b8
[DEBUG] snarkJS: Applying key: L Section: 0/1550
[DEBUG] snarkJS: Applying key: H Section: 0/2048
[INFO]  snarkJS: Circuit Hash: 
                03b24fd3 59989517 3c07396e 0f58a776
                1e336238 e40e56f6 7c72837d e5d6580a
                69d42af9 56e5ce79 f839de92 195664d1
                a3fd4451 23609dd5 a19724f9 ad3123b8
[INFO]  snarkJS: Contribution Hash: 
                dfa812c6 59d1f430 5cf4ef5c 844adbf9
                ee5b6233 013134ff 07c4bfb1 a91f2713
                1dd9b4f5 ff8774db 16e89b16 d9ab303d
                35020acf 1a276e1c 02ff3043 fa7cdd76
[INFO]  snarkJS: EXPORT VERIFICATION KEY STARTED
[INFO]  snarkJS: > Detected protocol: groth16
[INFO]  snarkJS: EXPORT VERIFICATION KEY FINISHED
[INFO]  snarkJS: EXPORT VERIFICATION KEY STARTED
[INFO]  snarkJS: > Detected protocol: groth16
[INFO]  snarkJS: EXPORT VERIFICATION KEY FINISHED
✅ Circuit compiled and files ready!```