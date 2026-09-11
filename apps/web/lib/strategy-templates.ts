export const strategyTemplates = [
  {
    id: 'balanced',
    name: 'Balanced',
    detail: 'Equal TCTC vault and ETH trigger.',
    tctcPct: 50,
  },
  {
    id: 'creditcoin-core',
    name: 'Creditcoin core',
    detail: 'Keep most capital in the CC3 vault.',
    tctcPct: 70,
  },
  {
    id: 'eth-tilt',
    name: 'ETH tilt',
    detail: 'Heavier Sepolia ETH trigger, lighter vault.',
    tctcPct: 30,
  },
] as const;

export type StrategyTemplateId = (typeof strategyTemplates)[number]['id'];

export function templateById(id: string | null) {
  return strategyTemplates.find((item) => item.id === id);
}
