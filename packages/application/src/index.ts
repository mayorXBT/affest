import { validateStrategy, type ValidatedStrategy } from '@affest/strategy-engine';

export interface DraftProvider {
  draftStrategy(instruction: string): Promise<unknown>;
}

export type DraftResult =
  | { readonly ok: true; readonly policy: ValidatedStrategy; readonly requiresUserApproval: true; readonly executable: false }
  | { readonly ok: false; readonly kind: 'invalid-draft'; readonly errors: readonly string[] };

export class StrategyApplicationService {
  public constructor(private readonly provider: DraftProvider) {}

  public async draft(instruction: string): Promise<DraftResult> {
    if (instruction.trim().length === 0) return { ok: false, kind: 'invalid-draft', errors: ['instruction is required'] };
    const output = await this.provider.draftStrategy(instruction);
    const validated = validateStrategy(output);
    if (!validated.ok) return { ok: false, kind: 'invalid-draft', errors: validated.errors };
    return { ok: true, policy: validated.value, requiresUserApproval: true, executable: false };
  }
}
