import { z } from 'zod';

const integerUnits = z.string().regex(/^(0|[1-9]\d*)$/, 'must be a non-negative integer token-unit string');
const asset = z.enum(['TCTC', 'ETH']);
const executionMode = z.enum(['APPROVAL', 'AUTOMATIC', 'HYBRID']);

export const strategySchema = z.object({
  sourceChain: z.literal('ethereum-sepolia'),
  trigger: z.object({
    type: z.literal('TOKEN_RECEIVED'),
    asset,
    minimumAmount: integerUnits,
  }),
  targetAllocation: z.array(z.object({ asset, weightBps: z.number().int().min(0).max(10_000) })).length(2),
  executionMode,
  automaticExecutionLimit: integerUnits,
  maximumActionAmount: integerUnits,
  maximumWeeklyAmount: integerUnits,
  maximumSlippageBps: z.number().int().min(0).max(1_000),
  expiresAt: z.number().int().nonnegative(),
});

export type StrategyInput = z.input<typeof strategySchema>;
export type ValidatedStrategy = z.output<typeof strategySchema>;
export type ValidationResult =
  | { readonly ok: true; readonly value: ValidatedStrategy }
  | { readonly ok: false; readonly errors: readonly string[] };

export function validateStrategy(input: unknown): ValidationResult {
  const parsed = strategySchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`) };
  const [first, second] = parsed.data.targetAllocation;
  if (first === undefined || second === undefined) {
    return { ok: false, errors: ['targetAllocation must contain exactly two entries'] };
  }
  if (first.asset === second.asset || first.weightBps + second.weightBps !== 10_000) {
    return { ok: false, errors: ['targetAllocation must contain both supported assets and total exactly 10,000 bps'] };
  }
  const autoLimit = BigInt(parsed.data.automaticExecutionLimit);
  const maxAction = BigInt(parsed.data.maximumActionAmount);
  const maxWeekly = BigInt(parsed.data.maximumWeeklyAmount);
  if (maxAction === 0n || maxWeekly === 0n || maxAction > maxWeekly || autoLimit > maxAction) {
    return { ok: false, errors: ['execution limits must be positive and ordered automatic <= action <= weekly'] };
  }
  if (parsed.data.executionMode !== 'APPROVAL' && parsed.data.expiresAt === 0) {
    return { ok: false, errors: ['automatic and hybrid strategies require an expiry'] };
  }
  return { ok: true, value: parsed.data };
}
