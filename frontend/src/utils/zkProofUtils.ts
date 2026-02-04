import { encodePacked } from 'viem';

export interface ZKProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  inputs: bigint[]; // Dynamic array for public signals
}

declare global {
  interface Window {
    snarkjs: any;
  }
}

/**
 * Generate real ZK proof for PrivyFlowIntent circuit
 * 
 * Circuit inputs:
 * - Private: amountIn, minAmountOut, userSignal
 * - Public: poolBalance0, poolBalance1, toxicityThreshold
 * - Outputs: valid, aggSignalHash (also become public signals)
 */
export async function generateRealZKProof(params: {
  amountIn: bigint;          // Private: actual swap amount
  minAmountOut: bigint;      // Private: minimum amount out (slippage protected)
  userSignal: bigint;        // Private: toxicity score/computed imbalance
  poolBalance0: bigint;      // Public: pool balance of token0
  poolBalance1: bigint;      // Public: pool balance of token1
  toxicityThreshold: bigint; // Public: max allowed toxicity
}): Promise<ZKProof> {
  
  if (!window.snarkjs) {
    throw new Error('snarkjs not loaded. Add <script src="/snarkjs.min.js"></script> to index.html');
  }

  // Circuit inputs must match your circom file exactly
  const circuitInputs = {
    // Private inputs
    amountIn: params.amountIn.toString(),
    minAmountOut: params.minAmountOut.toString(),
    userSignal: params.userSignal.toString(),
    
    // Public inputs
    poolBalance0: params.poolBalance0.toString(),
    poolBalance1: params.poolBalance1.toString(),
    toxicityThreshold: params.toxicityThreshold.toString(),
  };

  console.log('Generating ZK proof with inputs:', circuitInputs);

  try {
    // Try multiple paths for different dev environments
    const wasmPaths = [
      '/privacyflow.wasm',
      './privacyflow.wasm',
      `${process.env.PUBLIC_URL}/privacyflow.wasm`,
    ];
    
    const zkeyPaths = [
      '/privacyflow_final.zkey',
      './privacyflow_final.zkey',
      `${process.env.PUBLIC_URL}/privacyflow_final.zkey`,
    ];

    let lastError;
    let proof, publicSignals;

    // Try each path combination
    for (const wasmPath of wasmPaths) {
      for (const zkeyPath of zkeyPaths) {
        try {
          console.log(`Trying WASM: ${wasmPath}, ZKEY: ${zkeyPath}`);
          const result = await window.snarkjs.groth16.fullProve(
            circuitInputs,
            wasmPath,
            zkeyPath
          );
          proof = result.proof;
          publicSignals = result.publicSignals;
          console.log('Success with paths:', wasmPath, zkeyPath);
          break;
        } catch (e: any) {
          lastError = e;
          // Continue to next path
        }
      }
      if (proof) break;
    }

    if (!proof) {
      throw lastError;
    }

    console.log('Proof generated:', proof);
    console.log('Public signals (5 total):', publicSignals);
    // publicSignals should be: [poolBalance0, poolBalance1, toxicityThreshold, valid, aggSignalHash]

    // Verify we have exactly 5 public signals
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
 * Your contract expects: (uint[2] a, uint[2][2] b, uint[2] c, uint[5] inputs)
 * Total: 2 + 4 + 2 + 5 = 13 uint256 values
 */
export function encodeZKProof(proof: ZKProof): `0x${string}` {
  if (proof.inputs.length < 5) {
    throw new Error(`Expected at least 5 public signals, got ${proof.inputs.length}`);
  }

  // Take only first 5 inputs if more are provided
  const inputs = proof.inputs.slice(0, 5);

  const encoded = encodePacked(
    [
      'uint256', 'uint256', // a[0], a[1]
      'uint256', 'uint256', 'uint256', 'uint256', // b[0][0], b[0][1], b[1][0], b[1][1]
      'uint256', 'uint256', // c[0], c[1]
      'uint256', 'uint256', 'uint256', 'uint256', 'uint256' // inputs[0-4]
    ],
    [
      proof.a[0], proof.a[1],
      proof.b[0][0], proof.b[0][1], proof.b[1][0], proof.b[1][1],
      proof.c[0], proof.c[1],
      inputs[0], inputs[1], inputs[2], inputs[3], inputs[5]
    ]
  );

  return encoded;
}