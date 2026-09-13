import { Suspense } from 'react';
import { HoldingsTable } from '@/components/holdings-table';

export default function PortfolioPage() {
  return (
    <Suspense fallback={<p className="mt-6 text-[13px] text-muted">Loading portfolio.</p>}>
      <HoldingsTable />
    </Suspense>
  );
}
