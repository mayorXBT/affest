import { Suspense } from 'react';
import { StrategyBuilder } from '@/components/strategy-builder';

export default function StrategiesPage() {
  return (
    <Suspense fallback={<p className="mt-6 text-[13px] text-[#8f9a9b]">Loading builder.</p>}>
      <StrategyBuilder />
    </Suspense>
  );
}
