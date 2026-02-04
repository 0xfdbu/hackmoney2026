import { encodePacked } from 'viem';

export interface ZKProof {
  a: [bigint, bigint];
  b: [[bigint, bigint], [bigint, bigint]];
  c: [bigint, bigint];
  inputs: [bigint, bigint, bigint];
}

// Declare snarkjs from window
declare global {
  interface Window {
    snarkjs: any;
  }
}

/**
 * Generate real ZK proof using snarkjs in browser
 * 
 * @param walletAddress - User's wallet address (as private input)
 * @param toxicityScore - Privacy toxicity score (public input)
 * @param swapAmount - Swap amount (public input)
 * @returns Real ZK proof from snarkjs
 */
export async function generateRealZKProof(
  walletAddress: string,
  toxicityScore: number,
  swapAmount: bigint
): Promise<ZKProof> {
  
  // Wait for snarkjs to be available
  if (!window.snarkjs) {
    throw new Error('snarkjs not loaded. Make sure snarkjs.min.js is in public folder and loaded in index.html');
  }

  // Your circuit inputs - must match your circom circuit inputs
  // Assuming your circuit has inputs like:
  // - walletAddress (private) 
  // - toxicityScore (public)
  // - swapAmount (public)
  const circuitInputs = {
    // Private inputs (not revealed in proof)
    walletAddress: walletAddress,
    
    // Public inputs (revealed in publicSignals)
    toxicityScore: toxicityScore,
    swapAmount: swapAmount.toString(), // Convert bigint to string for JSON
  };

  console.log('Generating ZK proof with inputs:', circuitInputs);

  try {
    // Generate proof using snarkjs
    const { proof, publicSignals } = await window.snarkjs.groth16.fullProve(
      circuitInputs,
      "/privacyflow.wasm",        // Path to your wasm file in public folder
      "/privacyflow_final.zkey"   // Path to your zkey file in public folder
    );

    console.log('Proof generated:', proof);
    console.log('Public signals:', publicSignals);

    // Convert snarkjs proof format to your contract's expected format
    // snarkjs returns: { pi_a: [...], pi_b: [[...],[...]], pi_c: [...] }
    // Your contract expects: a, b, c arrays
    
    const formattedProof: ZKProof = {
      a: [
        BigInt(proof.pi_a[0]),
        BigInt(proof.pi_a[1])
      ],
      b: [
        [
          BigInt(proof.pi_b[0][0]),
          BigInt(proof.pi_b[0][1])
        ],
        [
          BigInt(proof.pi_b[1][0]),
          BigInt(proof.pi_b[1][1])
        ]
      ],
      c: [
        BigInt(proof.pi_c[0]),
        BigInt(proof.pi_c[1])
      ],
      inputs: [
        BigInt(publicSignals[0]), // toxicityScore
        BigInt(publicSignals[1]), // swapAmount
        BigInt(publicSignals[2])  // signalHash or other public signal
      ]
    };

    return formattedProof;

  } catch (error) {
    console.error('ZK proof generation failed:', error);
    throw new Error(`Failed to generate ZK proof: ${error.message}`);
  }
}

/**
 * Encode ZK proof for contract call
 * This matches your contract's abi.decode(hookData, (uint[2], uint[2][2], uint[2], uint[3]))
 */
export function encodeZKProof(proof: ZKProof): `0x${string}` {
  // Flatten the proof structure into the format expected by the contract
  const encodedProof = encodePacked(
    ['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 
     'uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
    [
      proof.a[0],
      proof.a[1],
      proof.b[0][0],
      proof.b[0][1],
      proof.b[1][0],
      proof.b[1][1],
      proof.c[0],
      proof.c[1],
      proof.inputs[0],
      proof.inputs[1],
      proof.inputs[2]
    ]
  );

  return encodedProof;
}

/**
 * Verify proof locally (optional, for testing)
 */
export async function verifyZKProof(
  proof: ZKProof, 
  publicSignals: [bigint, bigint, bigint],
  verificationKey: any
): Promise<boolean> {
  if (!window.snarkjs) {
    throw new Error('snarkjs not loaded');
  }

  // Convert back to snarkjs format
  const snarkjsProof = {
    pi_a: [proof.a[0].toString(), proof.a[1].toString()],
    pi_b: [
      [proof.b[0][0].toString(), proof.b[0][1].toString()],
      [proof.b[1][0].toString(), proof.b[1][1].toString()]
    ],
    pi_c: [proof.c[0].toString(), proof.c[1].toString()],
    protocol: "groth16",
    curve: "bn128"
  };

  const res = await window.snarkjs.groth16.verify(
    verificationKey,
    publicSignals.map(s => s.toString()),
    snarkjsProof
  );

  return res;
}