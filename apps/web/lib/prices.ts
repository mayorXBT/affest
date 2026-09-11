'use client';

import { useQuery } from '@tanstack/react-query';
import { formatUnits } from 'viem';

type MarketRow = {
  id: string;
  current_price: number;
  market_cap?: number;
  total_volume?: number;
  sparkline_in_7d?: { price?: number[] };
};

function isMarketRow(value: unknown): value is MarketRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.current_price === 'number';
}

function finiteNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function spark(row: MarketRow | undefined) {
  const prices = row?.sparkline_in_7d?.price;
  if (!prices || prices.length < 2) return [];
  return prices.filter((value) => Number.isFinite(value));
}

export function useSpotPrices() {
  return useQuery({
    queryKey: ['spot-prices', 'eth-ctc'],
    staleTime: 60_000,
    queryFn: async () => {
      const response = await fetch(
        'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=ethereum,creditcoin-2&sparkline=true',
      );
      if (!response.ok) throw new Error(`price http ${response.status}`);
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('price payload');
      const rows = payload.filter(isMarketRow);
      const eth = rows.find((row) => row.id === 'ethereum');
      const ctc = rows.find((row) => row.id === 'creditcoin-2');
      return {
        ethUsd: eth?.current_price ?? 0,
        ctcUsd: ctc?.current_price ?? 0,
        ethMcap: finiteNumber(eth?.market_cap),
        ctcMcap: finiteNumber(ctc?.market_cap),
        ethVolume: finiteNumber(eth?.total_volume),
        ctcVolume: finiteNumber(ctc?.total_volume),
        ethSpark: spark(eth),
        ctcSpark: spark(ctc),
      };
    },
  });
}

export function usdFromAmount(amount: bigint, usd: number) {
  if (usd <= 0) return undefined;
  const value = Number(formatUnits(amount, 18)) * usd;
  if (!Number.isFinite(value)) return undefined;
  return value;
}

export function formatUsd(value: number | undefined) {
  if (value === undefined) return '—';
  if (value === 0) return '$0';
  if (value < 0.01) return '<$0.01';
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 100 ? 0 : 2,
  });
}
