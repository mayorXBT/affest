import { parseAttestcoinProof } from '@affest/api-contracts';
import { SdkAttestationPort } from './adapters.js';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

/**
 * Inspect a real Attestcoin proof without signing or submitting anything.
 * This is intentionally read-only so it can be used by a judge during the
 * Phase 1 proof walkthrough.
 */
async function main(): Promise<void> {
  const transactionHash = requiredEnv('SOURCE_TRANSACTION_HASH');
  const proofApiUrl = requiredEnv('ATTESTCOIN_PROOF_API_URL');
  const attestation = new SdkAttestationPort(1, proofApiUrl);
  const attestedHeight = await attestation.getAttestedHeight(1);
  const rawProof = await attestation.buildProof(1, transactionHash);
  const parsed = parseAttestcoinProof(rawProof);
  if ('ok' in parsed) throw new Error(`proof response rejected: ${parsed.error}`);

  // Do not print transaction bytes or any credential material. The metadata
  // is enough to reproduce the next on-chain verification step.
  process.stdout.write(JSON.stringify({
    transactionHash: parsed.txHash,
    chainKey: parsed.chainKey,
    headerNumber: parsed.headerNumber,
    txIndex: parsed.txIndex,
    attestedHeight,
    cached: parsed.cached,
    generatedAt: parsed.generatedAt.toISOString(),
    continuityRoots: parsed.continuityProof.roots.length,
    merkleSiblings: parsed.merkleProof.siblings.length,
  }, null, 2) + '\n');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'proof inspection failed';
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
