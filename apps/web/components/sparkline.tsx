'use client';

export function Sparkline({
  values,
  color,
  fill,
  width = 96,
  height = 40,
}: {
  values: readonly number[];
  color: string;
  fill?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <span className="block" style={{ width, height }} />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 2;
  const coords = values.map((value, index) => {
    const x = pad + (index / (values.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (value - min) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ');
  const last = coords[coords.length - 1];
  const first = coords[0];
  const area = last && first
    ? `${line} L${last[0].toFixed(2)} ${(height - pad).toFixed(2)} L${first[0].toFixed(2)} ${(height - pad).toFixed(2)} Z`
    : line;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="overflow-visible" aria-hidden="true">
      {fill ? <path d={area} fill={fill} /> : null}
      <path d={line} fill="none" stroke={color} strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function SimulationChart({
  strategy,
  eth,
  tctc,
}: {
  strategy: readonly number[];
  eth: readonly number[];
  tctc: readonly number[];
}) {
  const series = [
    { values: strategy, color: '#d6f26a', label: 'Strategy' },
    { values: eth, color: '#7f92e6', label: 'ETH' },
    { values: tctc, color: '#9b7fe6', label: 'TCTC' },
  ].filter((item) => item.values.length > 1);

  if (series.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-ink-2 p-3 text-[12px] leading-relaxed text-[#8f9a9b]">
        Start building for the backtest to start.
      </p>
    );
  }

  const all = series.flatMap((item) => item.values);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const width = 280;
  const height = 120;
  const padX = 8;
  const padY = 12;
  const ticks = [max, (max + min) / 2, min];

  function path(values: readonly number[]) {
    return values.map((value, index) => {
      const x = padX + (index / (values.length - 1)) * (width - padX * 2);
      const y = padY + (1 - (value - min) / span) * (height - padY * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(' ');
  }

  const zeroY = padY + (1 - (0 - min) / span) * (height - padY * 2);

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[120px] w-full" aria-label="Portfolio simulation">
        <line x1={padX} x2={width - padX} y1={zeroY} y2={zeroY} stroke="#3a4548" strokeWidth="1" />
        {series.map((item) => (
          <path key={item.label} d={path(item.values)} fill="none" stroke={item.color} strokeWidth="1.6" />
        ))}
        {ticks.map((tick) => (
          <text
            key={tick}
            x={4}
            y={padY + (1 - (tick - min) / span) * (height - padY * 2) + 3}
            fill="#6f7c7d"
            fontSize="8"
          >
            {`${tick >= 0 ? '+' : ''}${(tick * 100).toFixed(1)}%`}
          </text>
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-[#8f9a9b]">
        {series.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <i className="inline-block size-1.5 rounded-full" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function toReturnSeries(prices: readonly number[]) {
  const start = prices[0];
  if (!start) return [];
  return prices.map((price) => price / start - 1);
}

export function mixReturnSeries(left: readonly number[], right: readonly number[], leftWeight: number) {
  const length = Math.min(left.length, right.length);
  if (length < 2) return left.length >= 2 ? [...left] : [...right];
  const rightWeight = 1 - leftWeight;
  return Array.from({ length }, (_, index) => (left[index] ?? 0) * leftWeight + (right[index] ?? 0) * rightWeight);
}
