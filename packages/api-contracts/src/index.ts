import { z } from 'zod';

const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'expected a 32-byte hex value');
const proofSchema = z.object({
  chainKey: z.number().int().nonnegative(),
  headerNumber: z.number().int().nonnegative(),
  txIndex: z.number().int().nonnegative(),
  txHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  txBytes: z.string().regex(/^0x[0-9a-fA-F]*$/),
  continuityProof: z.object({
    lowerEndpointDigest: bytes32,
    roots: z.array(bytes32).min(1, 'expected at least one attested root'),
  }),
  merkleProof: z.object({
    root: bytes32,
    siblings: z.array(z.object({ hash: bytes32, isLeft: z.boolean() })),
  }),
  cached: z.boolean(),
  generatedAt: z.coerce.date(),
});

export type AttestcoinProof = z.output<typeof proofSchema>;
export type ProofParseResult = AttestcoinProof | { readonly ok: false; readonly error: string };

export function parseAttestcoinProof(input: unknown): ProofParseResult {
  const result = proofSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    return { ok: false, error: `${issue?.path.join('.') ?? 'proof'}: ${issue?.message ?? 'invalid proof'}` };
  }
  return result.data;
}
