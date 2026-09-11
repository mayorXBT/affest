import { StrategyDashboard } from '@/components/strategy-dashboard';

export default async function StrategyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StrategyDashboard id={id} />;
}
