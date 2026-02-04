import { encodePacked } from 'viem';

export interface ZKProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  inputs: bigint[]; // Public signals in snarkjs order: [outputs..., publicInputs...]
}

declare global {
  interface Window {
    snarkjs: any;
  }
}

/**
 * Generate real ZK proof for PrivyFlowIntent circuit
 * 
 * Circuit structure:
 * - Private inputs: amountIn, minAmountOut, userSignal
 * - Public inputs (in circom): poolBalance0, poolBalance1, toxicityThreshold
 * - Outputs: valid, aggSignalHash
 * 
 * Snarkjs publicSignals order: [valid, aggSignalHash, poolBalance0, poolBalance1, toxicityThreshold]
 * (Outputs first, then public inputs)
 */
export async function generateRealZKProof(params: {
  amountIn: bigint;          // Private
  minAmountOut: bigint;      // Private
  userSignal: bigint;        // Private
  poolBalance0: bigint;      // Public
  poolBalance1: bigint;      // Public
  toxicityThreshold: bigint; // Public
}): Promise<ZKProof> {
  
  if (!window.snarkjs) {
    throw new Error('snarkjs not loaded. Add <script src="/snarkjs.min.js"></script> to index.html');
  }

  const circuitInputs = {
    amountIn: params.amountIn.toString(),
    minAmountOut: params.minAmountOut.toString(),
    userSignal: params.userSignal.toString(),
    poolBalance0: params.poolBalance0.toString(),
    poolBalance1: params.poolBalance1.toString(),
    toxicityThreshold: params.toxicityThreshold.toString(),
  };

  console.log('Generating ZK proof with inputs:', circuitInputs);

  try {
    const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
      circuitInputs,
      "/privacyflow.wasm",
      "/privacyflow_final.zkey"
    );

    console.log('Raw public signals from snarkjs:', publicSignals);
    // Expected: [valid, aggSignalHash, poolBalance0, poolBalance1, toxicityThreshold]

    if (publicSignals.length !== 5) {
      console.warn(`Expected 5 public signals, got ${publicSignals.length}`);
    }

    const formattedProof: ZKProof = {
      a: [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])],
      b: [
        [BigInt(proof.pi_b[0][0]), BigInt(proof.pi_b[0][1])],
        [BigInt(proof.pi_b[1][0]), BigInt(proof.pi_b[1][1])]
      ],
      c: [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])],
      inputs: publicSignals.map((s: string) => BigInt(s))
    };

    return formattedProof;

  } catch (error: any) {
    console.error('ZK proof generation failed:', error);
    throw new Error(`Failed to generate ZK proof: ${error.message}`);
  }
}

/**
 * Encode ZK proof for contract call
 * 
 * CRITICAL: Reorder public signals to match verifier contract expectation!
 * 
 * Snarkjs order:    [valid, aggSignalHash, poolBalance0, poolBalance1, toxicityThreshold]
 *                        0          1              2            3              4
 * 
 * Contract expects: [poolBalance0, poolBalance1, toxicityThreshold, valid, aggSignalHash]
 *                        0            1                2             3          4
 */
export function encodeZKProof(proof: ZKProof): `0x${string}` {
  if (proof.inputs.length < 5) {
    throw new Error(`Expected 5 public signals, got ${proof.inputs.length}`);
  }

  // Reorder: snarkjs [out0, out1, pub0, pub1, pub2] -> contract [pub0, pub1, pub2, out0, out1]
  const snarkValid = proof.inputs[0];
  const snarkAggHash = proof.inputs[1];
  const snarkPool0 = proof.inputs[2];
  const snarkPool1 = proof.inputs[3];
  const snarkThreshold = proof.inputs[4];

  // Contract expects: [poolBalance0, poolBalance1, toxicityThreshold, valid, aggSignalHash]
  const contractInputs = [
    snarkPool0,      // public input 0
    snarkPool1,      // public input 1
    snarkThreshold,  // public input 2
    snarkValid,      // output 0
    snarkAggHash     // output 1
  ];

  console.log('Reordered public signals for contract:', contractInputs.map(x => x.toString()));

  // Encode as: a[2], b[4], c[2], inputs[5] = 13 uint256 values
  const encoded = encodePacked(
    [
      'uint256', 'uint256', // a[0], a[1]
      'uint256', 'uint256', 'uint256', 'uint256', // b[0][0], b[0][1], b[1][0], b[1][1]
      'uint256', 'uint256', // c[0], c[1]
      'uint256', 'uint256', 'uint256', 'uint256', 'uint256' // inputs[0..4]
    ],
    [
      proof.a[0], proof.a[1],
      proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
      proof.c[0], proof.c[1],
      contractInputs[0], contractInputs[1], contractInputs[2], contractInputs[3], contractInputs[4]
    ]
  );

  return encoded;
}

/**
 * Alternative: If you want to verify the proof matches your inputs
 * Call this to check proof is valid before sending to chain
 */
export async function verifyProofLocal(
  proof: ZKProof,
  verificationKey: any
): Promise<boolean> {
  if (!window.snarkjs) {
    throw new Error('snarkjs not loaded');
  }

  const snarkjsProof = {
    pi_a: [proof.a[0].toString(), proof.a[1].toString(), '1'],
    pi_b: [
      [proof.b[0][0].toString(), proof.b[0][1].toString()],
      [proof.b[1][0].toString(), proof.b[1][1].toString()],
      ['1', '0']
    ],
    pi_c: [proof.c[0].toString(), proof.c[1].toString(), '1'],
    protocol: "groth16",
    curve: "bn128"
  };

  // Use original snarkjs order for verification
  const publicSignals = proof.inputs.map(x => x.toString());

  const res = await window.snarkjs.groth16.verify(
    verificationKey,
    publicSignals,
    snarkjsProof
  );

  return res;
}