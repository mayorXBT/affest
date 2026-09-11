import { formatUnits } from 'viem';

export function shortAddress(value: string) {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatToken(value: bigint, decimals = 18, digits = 4) {
  const asNumber = Number(formatUnits(value, decimals));
  if (!Number.isFinite(asNumber)) return formatUnits(value, decimals);
  if (asNumber === 0) return '0';
  if (asNumber < 0.0001) return '<0.0001';
  return asNumber.toLocaleString(undefined, { maximumFractionDigits: digits });
}
